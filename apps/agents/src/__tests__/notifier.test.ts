import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Must mock logger before importing notifier
vi.mock('../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { logger } from '../logger.js';

describe('Notifier', () => {
  const mockFetch = vi.fn();
  let savedUrl: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    savedUrl = process.env.DISCORD_WEBHOOK_URL;
    mockFetch.mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    if (savedUrl !== undefined) {
      process.env.DISCORD_WEBHOOK_URL = savedUrl;
    } else {
      delete process.env.DISCORD_WEBHOOK_URL;
    }
    vi.unstubAllGlobals();
  });

  async function loadNotifier() {
    const mod = await import('../notifier.js');
    return mod.notifier;
  }

  describe('sendAlert()', () => {
    it('sends alert embed to Discord webhook', async () => {
      process.env.DISCORD_WEBHOOK_URL = 'https://discord.test/webhook';
      const notifier = await loadNotifier();

      await notifier.sendAlert({
        severity: 'critical',
        title: 'Drawdown Alert',
        message: 'Portfolio drawdown exceeds 10%',
        ticker: 'SPY',
      });

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://discord.test/webhook');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(options.body);
      expect(body.embeds).toHaveLength(1);
      expect(body.embeds[0].title).toContain('Critical Alert');
      expect(body.embeds[0].title).toContain('Drawdown Alert');
      expect(body.embeds[0].description).toBe('Portfolio drawdown exceeds 10%');
      expect(body.embeds[0].color).toBe(0xff0000); // red for critical
    });

    it('uses warning color and emoji for warning alerts', async () => {
      process.env.DISCORD_WEBHOOK_URL = 'https://discord.test/webhook';
      const notifier = await loadNotifier();

      await notifier.sendAlert({
        severity: 'warning',
        title: 'Risk Warning',
        message: 'Approaching drawdown limit',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.embeds[0].title).toContain('⚠️');
      expect(body.embeds[0].title).toContain('Warning');
      expect(body.embeds[0].color).toBe(0xffaa00);
    });

    it('uses info color and emoji for info alerts', async () => {
      process.env.DISCORD_WEBHOOK_URL = 'https://discord.test/webhook';
      const notifier = await loadNotifier();

      await notifier.sendAlert({
        severity: 'info',
        title: 'Info Alert',
        message: 'Something noteworthy',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.embeds[0].title).toContain('ℹ️');
      expect(body.embeds[0].color).toBe(0x3498db);
    });

    it('includes ticker field when provided', async () => {
      process.env.DISCORD_WEBHOOK_URL = 'https://discord.test/webhook';
      const notifier = await loadNotifier();

      await notifier.sendAlert({
        severity: 'warning',
        title: 'Price Alert',
        message: 'Big move',
        ticker: 'AAPL',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const fields = body.embeds[0].fields;
      expect(fields.find((f: any) => f.name === 'Ticker')?.value).toBe('AAPL');
    });

    it('is a no-op when DISCORD_WEBHOOK_URL is not set', async () => {
      delete process.env.DISCORD_WEBHOOK_URL;
      const notifier = await loadNotifier();

      await notifier.sendAlert({
        severity: 'critical',
        title: 'Test',
        message: 'Test',
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('logs error when webhook returns non-OK status', async () => {
      process.env.DISCORD_WEBHOOK_URL = 'https://discord.test/webhook';
      const notifier = await loadNotifier();
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limited'),
      });

      await notifier.sendAlert({
        severity: 'info',
        title: 'Test',
        message: 'Test',
      });

      expect(logger.error).toHaveBeenCalledWith(
        'notifier.discord.error',
        expect.objectContaining({ status: 429 }),
      );
    });

    it('logs error when fetch throws', async () => {
      process.env.DISCORD_WEBHOOK_URL = 'https://discord.test/webhook';
      const notifier = await loadNotifier();
      mockFetch.mockRejectedValue(new Error('Network failure'));

      await notifier.sendAlert({
        severity: 'info',
        title: 'Test',
        message: 'Test',
      });

      expect(logger.error).toHaveBeenCalledWith(
        'notifier.discord.failed',
        expect.objectContaining({ error: 'Network failure' }),
      );
    });
  });

  describe('sendSignal()', () => {
    it('sends buy signal embed to Discord', async () => {
      process.env.DISCORD_WEBHOOK_URL = 'https://discord.test/webhook';
      const notifier = await loadNotifier();

      await notifier.sendSignal({
        ticker: 'AAPL',
        side: 'buy',
        quantity: 100,
        reason: 'Strong momentum signal',
        strategy_name: 'momentum_breakout',
        signal_strength: 0.85,
      });

      expect(mockFetch).toHaveBeenCalledOnce();
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.embeds[0].title).toContain('🟢');
      expect(body.embeds[0].title).toContain('BUY Signal: AAPL');
      expect(body.embeds[0].color).toBe(0x2ecc71); // green
      expect(body.embeds[0].description).toBe('Strong momentum signal');

      const fieldNames = body.embeds[0].fields.map((f: any) => f.name);
      expect(fieldNames).toContain('Ticker');
      expect(fieldNames).toContain('Side');
      expect(fieldNames).toContain('Quantity');
      expect(fieldNames).toContain('Strategy');
      expect(fieldNames).toContain('Strength');
    });

    it('sends sell signal with red color', async () => {
      process.env.DISCORD_WEBHOOK_URL = 'https://discord.test/webhook';
      const notifier = await loadNotifier();

      await notifier.sendSignal({
        ticker: 'TSLA',
        side: 'sell',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.embeds[0].title).toContain('🔴');
      expect(body.embeds[0].title).toContain('SELL Signal: TSLA');
      expect(body.embeds[0].color).toBe(0xe74c3c);
    });

    it('is a no-op when DISCORD_WEBHOOK_URL is not set', async () => {
      delete process.env.DISCORD_WEBHOOK_URL;
      const notifier = await loadNotifier();

      await notifier.sendSignal({ ticker: 'AAPL', side: 'buy' });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('uses default description when reason is not provided', async () => {
      process.env.DISCORD_WEBHOOK_URL = 'https://discord.test/webhook';
      const notifier = await loadNotifier();

      await notifier.sendSignal({ ticker: 'MSFT', side: 'buy' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.embeds[0].description).toContain('buy signal for MSFT');
    });

    it('formats signal_strength as percentage', async () => {
      process.env.DISCORD_WEBHOOK_URL = 'https://discord.test/webhook';
      const notifier = await loadNotifier();

      await notifier.sendSignal({
        ticker: 'AAPL',
        side: 'buy',
        signal_strength: 0.85,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const strengthField = body.embeds[0].fields.find((f: any) => f.name === 'Strength');
      expect(strengthField.value).toBe('85%');
    });
  });
});
