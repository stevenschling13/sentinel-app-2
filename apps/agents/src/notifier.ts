/**
 * Discord webhook notifier for critical alerts and signals.
 * Graceful no-op when DISCORD_WEBHOOK_URL is not configured.
 */

import { logger } from './logger.js';

interface AlertPayload {
  severity: string;
  title: string;
  message: string;
  ticker?: string;
}

interface SignalPayload {
  ticker: string;
  side: string;
  quantity?: number;
  reason?: string;
  signal_strength?: number;
  strategy_name?: string;
}

// Severity → Discord embed color mapping
const SEVERITY_COLORS: Record<string, number> = {
  critical: 0xff0000, // red
  warning: 0xffaa00, // amber
  info: 0x3498db, // blue
};

const SIDE_COLORS: Record<string, number> = {
  buy: 0x2ecc71, // green
  sell: 0xe74c3c, // red
};

const SIDE_EMOJI: Record<string, string> = {
  buy: '🟢',
  sell: '🔴',
};

class RateLimiter {
  private timestamps: number[] = [];
  private readonly maxPerMinute: number;

  constructor(maxPerMinute: number) {
    this.maxPerMinute = maxPerMinute;
  }

  canSend(): boolean {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < 60_000);
    if (this.timestamps.length >= this.maxPerMinute) return false;
    this.timestamps.push(now);
    return true;
  }
}

class Notifier {
  private webhookUrl: string | undefined;
  private rateLimiter = new RateLimiter(10);

  constructor() {
    this.webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (this.webhookUrl) {
      logger.info('notifier.enabled', { target: 'discord' });
    } else {
      logger.info('notifier.disabled', { reason: 'DISCORD_WEBHOOK_URL not set' });
    }
  }

  async sendAlert(alert: AlertPayload): Promise<void> {
    if (!this.webhookUrl) return;
    if (!this.rateLimiter.canSend()) {
      logger.warn('notifier.rate-limited', { title: alert.title });
      return;
    }

    const severityEmoji =
      alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️';

    const fields = [{ name: 'Severity', value: alert.severity, inline: true }];
    if (alert.ticker) {
      fields.unshift({ name: 'Ticker', value: alert.ticker, inline: true });
    }

    const payload = {
      embeds: [
        {
          title: `${severityEmoji} ${alert.severity === 'critical' ? 'Critical' : alert.severity === 'warning' ? 'Warning' : 'Info'} Alert: ${alert.title}`,
          description: alert.message,
          color: SEVERITY_COLORS[alert.severity] ?? SEVERITY_COLORS.info,
          fields,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    await this.send(payload);
  }

  async sendSignal(signal: SignalPayload): Promise<void> {
    if (!this.webhookUrl) return;
    if (!this.rateLimiter.canSend()) {
      logger.warn('notifier.rate-limited', { ticker: signal.ticker });
      return;
    }

    const emoji = SIDE_EMOJI[signal.side] ?? '📊';
    const fields = [
      { name: 'Ticker', value: signal.ticker, inline: true },
      { name: 'Side', value: signal.side.toUpperCase(), inline: true },
    ];
    if (signal.quantity != null) {
      fields.push({ name: 'Quantity', value: String(signal.quantity), inline: true });
    }
    if (signal.strategy_name) {
      fields.push({ name: 'Strategy', value: signal.strategy_name, inline: true });
    }
    if (signal.signal_strength != null) {
      fields.push({
        name: 'Strength',
        value: `${(signal.signal_strength * 100).toFixed(0)}%`,
        inline: true,
      });
    }

    const payload = {
      embeds: [
        {
          title: `${emoji} ${signal.side.toUpperCase()} Signal: ${signal.ticker}`,
          description: signal.reason ?? `New ${signal.side} signal for ${signal.ticker}`,
          color: SIDE_COLORS[signal.side] ?? 0x95a5a6,
          fields,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    await this.send(payload);
  }

  private async send(payload: unknown): Promise<void> {
    try {
      const res = await fetch(this.webhookUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        logger.error('notifier.discord.error', {
          status: res.status,
          body: await res.text().catch(() => ''),
        });
      }
    } catch (err) {
      logger.error('notifier.discord.failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export const notifier = new Notifier();
