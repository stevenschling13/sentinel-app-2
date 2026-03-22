/**
 * Autonomous trade execution pipeline.
 * Processes approved recommendations through risk checks and order submission.
 */

import { EngineClient } from './engine-client.js';
import {
  getRecommendation,
  listRecommendations,
  markFilled,
  markRiskBlocked,
} from './recommendations-store.js';
import { logger } from './logger.js';
import { eventBus } from './event-bus.js';

interface ExecutionConfig {
  autoExecute: boolean;
  maxOrdersPerCycle: number;
  maxOrderValue: number;
  tradingMode: 'paper' | 'live';
}

export class ExecutionPipeline {
  private engine: EngineClient;
  private config: ExecutionConfig;

  constructor(engine?: EngineClient) {
    this.engine = engine ?? new EngineClient();
    this.config = {
      autoExecute: process.env.AUTO_EXECUTE === 'true',
      maxOrdersPerCycle: Number(process.env.MAX_ORDERS_PER_CYCLE) || 3,
      maxOrderValue: Number(process.env.MAX_ORDER_VALUE) || 5000,
      tradingMode: (process.env.TRADING_MODE as 'paper' | 'live') || 'paper',
    };
  }

  get currentConfig(): ExecutionConfig {
    return { ...this.config };
  }

  /** Process a single approved recommendation through risk checks and order submission. */
  async executeRecommendation(
    recId: string,
  ): Promise<{ success: boolean; orderId?: string; reason?: string }> {
    logger.info('execution.start', { recId });

    // 1. Fetch recommendation
    const rec = await getRecommendation(recId);
    if (!rec) {
      logger.warn('execution.not_found', { recId });
      return { success: false, reason: 'Recommendation not found' };
    }

    // 2. Validate it's still 'approved'
    if (rec.status !== 'approved') {
      logger.warn('execution.invalid_status', { recId, status: rec.status });
      return { success: false, reason: `Invalid status: ${rec.status}` };
    }

    // 3. Resolve current price
    let price = rec.limit_price;
    if (!price) {
      try {
        const quotes = await this.engine.getQuotes([rec.ticker]);
        price = quotes[0]?.close ?? 0;
      } catch {
        price = 0;
      }
    }

    // 4. Check dollar value doesn't exceed maxOrderValue
    const orderValue = rec.quantity * price;
    if (orderValue > this.config.maxOrderValue) {
      const reason = `Order value $${orderValue.toFixed(2)} exceeds limit of $${this.config.maxOrderValue}`;
      logger.warn('execution.value_exceeded', {
        recId,
        orderValue,
        max: this.config.maxOrderValue,
      });
      await markRiskBlocked(recId, reason);
      return { success: false, reason };
    }

    // 5. Run pre-trade risk check via engine
    try {
      const [acct, positions] = await Promise.all([
        this.engine.getAccount(),
        this.engine.getPositions(),
      ]);
      const positionsMap: Record<string, number> = {};
      for (const p of positions) {
        positionsMap[p.instrument_id] = p.market_value ?? p.quantity * (p.avg_price ?? 0);
      }

      const riskCheck = await this.engine.preTradeCheck({
        ticker: rec.ticker,
        shares: rec.quantity,
        price,
        side: rec.side,
        equity: acct.equity,
        cash: acct.cash,
        peak_equity: acct.initial_capital ?? acct.equity,
        daily_starting_equity: acct.initial_capital ?? acct.equity,
        positions: positionsMap,
        position_sectors: {},
      });

      if (!riskCheck.allowed) {
        const reason = `Risk check blocked: ${riskCheck.reason}`;
        logger.warn('execution.risk_blocked', { recId, reason: riskCheck.reason });
        await markRiskBlocked(recId, reason);
        return { success: false, reason };
      }

      const finalShares = riskCheck.adjusted_shares ?? rec.quantity;

      // 6. Submit order to engine
      logger.info('execution.submitting', {
        recId,
        ticker: rec.ticker,
        shares: finalShares,
        side: rec.side,
        orderType: rec.order_type,
      });

      const order = await this.engine.submitOrder({
        ticker: rec.ticker,
        shares: finalShares,
        side: rec.side,
        order_type: rec.order_type,
        limit_price: rec.limit_price,
      });

      // 7. Mark as filled with orderId
      await markFilled(recId, order.order_id);

      // 8. Publish event to eventBus
      await eventBus.publish('order.submitted', {
        ticker: rec.ticker,
        side: rec.side,
        quantity: finalShares,
      });

      logger.info('execution.filled', {
        recId,
        orderId: order.order_id,
        status: order.status,
        filledPrice: order.filled_price,
      });

      return { success: true, orderId: order.order_id };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      logger.error('execution.failed', { recId, error: reason });
      await markRiskBlocked(recId, `Execution error: ${reason}`);
      return { success: false, reason };
    }
  }

  /** Process all approved recommendations (for auto-execute mode). */
  async processApprovedRecommendations(): Promise<void> {
    const approved = await listRecommendations('approved');
    if (approved.length === 0) {
      logger.info('execution.process.none', { message: 'No approved recommendations' });
      return;
    }

    const toProcess = approved.slice(0, this.config.maxOrdersPerCycle);
    logger.info('execution.process.start', {
      total: approved.length,
      processing: toProcess.length,
      maxPerCycle: this.config.maxOrdersPerCycle,
    });

    let successCount = 0;
    for (const rec of toProcess) {
      const result = await this.executeRecommendation(rec.id);
      if (result.success) successCount++;
    }

    logger.info('execution.process.complete', {
      processed: toProcess.length,
      succeeded: successCount,
      failed: toProcess.length - successCount,
    });
  }
}
