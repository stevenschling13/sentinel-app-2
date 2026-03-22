'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  createChart,
  createTextWatermark,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { BarData, Timeframe } from '@/hooks/use-chart-data';
import { cn } from '@/lib/utils';

/* ─── Indicator helpers ─── */

function calcSMA(data: BarData[], period: number): { time: UTCTimestamp; value: number }[] {
  const result: { time: UTCTimestamp; value: number }[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j].close;
    result.push({ time: data[i].time as UTCTimestamp, value: +(sum / period).toFixed(4) });
  }
  return result;
}

function calcEMA(data: BarData[], period: number): { time: UTCTimestamp; value: number }[] {
  const k = 2 / (period + 1);
  const result: { time: UTCTimestamp; value: number }[] = [];
  if (data.length === 0) return result;

  // Seed with SMA of first `period` bars
  let sum = 0;
  for (let i = 0; i < Math.min(period, data.length); i++) sum += data[i].close;
  let ema = sum / Math.min(period, data.length);
  result.push({
    time: data[Math.min(period - 1, data.length - 1)].time as UTCTimestamp,
    value: +ema.toFixed(4),
  });

  for (let i = period; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k);
    result.push({ time: data[i].time as UTCTimestamp, value: +ema.toFixed(4) });
  }
  return result;
}

function calcBollingerBands(
  data: BarData[],
  period: number = 20,
  mult: number = 2,
): {
  upper: { time: UTCTimestamp; value: number }[];
  middle: { time: UTCTimestamp; value: number }[];
  lower: { time: UTCTimestamp; value: number }[];
} {
  const upper: { time: UTCTimestamp; value: number }[] = [];
  const middle: { time: UTCTimestamp; value: number }[] = [];
  const lower: { time: UTCTimestamp; value: number }[] = [];

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j].close;
    const mean = sum / period;

    let sqSum = 0;
    for (let j = 0; j < period; j++) sqSum += (data[i - j].close - mean) ** 2;
    const std = Math.sqrt(sqSum / period);

    const t = data[i].time as UTCTimestamp;
    middle.push({ time: t, value: +mean.toFixed(4) });
    upper.push({ time: t, value: +(mean + mult * std).toFixed(4) });
    lower.push({ time: t, value: +(mean - mult * std).toFixed(4) });
  }
  return { upper, middle, lower };
}

/* ─── Types ─── */

type IndicatorKey = 'sma20' | 'sma50' | 'ema12' | 'ema26' | 'bb';

interface IndicatorConfig {
  label: string;
  color: string;
}

const INDICATOR_CONFIGS: Record<IndicatorKey, IndicatorConfig> = {
  sma20: { label: 'SMA 20', color: '#f59e0b' },
  sma50: { label: 'SMA 50', color: '#8b5cf6' },
  ema12: { label: 'EMA 12', color: '#06b6d4' },
  ema26: { label: 'EMA 26', color: '#ec4899' },
  bb: { label: 'Bollinger', color: '#6366f1' },
};

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: '1m', label: '1m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '1h', label: '1H' },
  { value: '1d', label: '1D' },
  { value: '1w', label: '1W' },
];

/* ─── Component ─── */

interface TradingChartProps {
  bars: BarData[];
  ticker: string;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  className?: string;
}

export function TradingChart({
  bars,
  ticker,
  timeframe,
  onTimeframeChange,
  className,
}: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const indicatorSeriesRefs = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());

  const [activeIndicators, setActiveIndicators] = useState<Set<IndicatorKey>>(new Set(['sma20']));

  const toggleIndicator = useCallback((key: IndicatorKey) => {
    setActiveIndicators((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Compute indicator data
  const indicatorData = useMemo(() => {
    if (bars.length === 0) return {};
    const result: Record<string, { time: UTCTimestamp; value: number }[]> = {};
    result.sma20 = calcSMA(bars, 20);
    result.sma50 = calcSMA(bars, 50);
    result.ema12 = calcEMA(bars, 12);
    result.ema26 = calcEMA(bars, 26);
    const bb = calcBollingerBands(bars, 20, 2);
    result.bb_upper = bb.upper;
    result.bb_middle = bb.middle;
    result.bb_lower = bb.lower;
    return result;
  }, [bars]);

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#09090b' },
        textColor: '#a1a1aa',
        fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: '#27272a' },
        horzLines: { color: '#27272a' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#52525b', width: 1, labelBackgroundColor: '#27272a' },
        horzLine: { color: '#52525b', width: 1, labelBackgroundColor: '#27272a' },
      },
      rightPriceScale: {
        borderColor: '#27272a',
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: '#27272a',
        timeVisible: timeframe !== '1d' && timeframe !== '1w',
        secondsVisible: false,
      },
    });

    // Ticker watermark via v5 plugin
    const mainPane = chart.panes()[0];
    createTextWatermark(mainPane, {
      lines: [{ text: ticker, color: 'rgba(255,255,255,0.04)', fontSize: 48 }],
    });

    chartRef.current = chart;

    // Candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      wickUpColor: '#22c55e',
    });
    candleSeriesRef.current = candleSeries;

    // Volume histogram
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    // Resize observer
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        chart.applyOptions({ width, height });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      indicatorSeriesRefs.current.clear();
    };
    // Only recreate chart when ticker or timeframe changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, timeframe]);

  // Update candlestick & volume data
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || bars.length === 0) return;

    const candleData = bars.map((b) => ({
      time: b.time as UTCTimestamp,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));
    candleSeriesRef.current.setData(candleData);

    const volumeData = bars.map((b) => ({
      time: b.time as UTCTimestamp,
      value: b.volume,
      color: b.close >= b.open ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
    }));
    volumeSeriesRef.current.setData(volumeData);

    chartRef.current?.timeScale().fitContent();
  }, [bars]);

  // Update indicator overlays
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // Remove series that are no longer active
    for (const [key, series] of indicatorSeriesRefs.current.entries()) {
      if (!activeIndicators.has(key as IndicatorKey) && !key.startsWith('bb_')) {
        chart.removeSeries(series);
        indicatorSeriesRefs.current.delete(key);
      }
    }

    // Remove BB series if bb not active
    if (!activeIndicators.has('bb')) {
      for (const bbKey of ['bb_upper', 'bb_middle', 'bb_lower']) {
        const s = indicatorSeriesRefs.current.get(bbKey);
        if (s) {
          chart.removeSeries(s);
          indicatorSeriesRefs.current.delete(bbKey);
        }
      }
    }

    // Add/update active indicators
    for (const key of activeIndicators) {
      if (key === 'bb') {
        // Bollinger bands: 3 lines
        for (const bbKey of ['bb_upper', 'bb_middle', 'bb_lower'] as const) {
          const data = indicatorData[bbKey];
          if (!data) continue;
          let series = indicatorSeriesRefs.current.get(bbKey);
          if (!series) {
            series = chart.addSeries(LineSeries, {
              color: bbKey === 'bb_middle' ? '#6366f1' : 'rgba(99,102,241,0.4)',
              lineWidth: bbKey === 'bb_middle' ? 1 : 1,
              lineStyle: bbKey === 'bb_middle' ? 0 : 2, // 0=Solid, 2=Dashed
              crosshairMarkerVisible: false,
              priceLineVisible: false,
              lastValueVisible: false,
            });
            indicatorSeriesRefs.current.set(bbKey, series);
          }
          series.setData(data);
        }
      } else {
        const config = INDICATOR_CONFIGS[key];
        const data = indicatorData[key];
        if (!data) continue;
        let series = indicatorSeriesRefs.current.get(key);
        if (!series) {
          series = chart.addSeries(LineSeries, {
            color: config.color,
            lineWidth: 1,
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          indicatorSeriesRefs.current.set(key, series);
        }
        series.setData(data);
      }
    }
  }, [activeIndicators, indicatorData]);

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 bg-zinc-950 px-3 py-2">
        {/* Timeframe selector */}
        <div className="flex items-center gap-0.5 rounded-md bg-zinc-900 p-0.5">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => onTimeframeChange(tf.value)}
              className={cn(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                timeframe === tf.value
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-400 hover:text-zinc-200',
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>

        <div className="mx-1 h-5 w-px bg-zinc-800" />

        {/* Indicator toggles */}
        <div className="flex flex-wrap items-center gap-1">
          {(Object.entries(INDICATOR_CONFIGS) as [IndicatorKey, IndicatorConfig][]).map(
            ([key, config]) => (
              <button
                key={key}
                onClick={() => toggleIndicator(key)}
                className={cn(
                  'rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors',
                  activeIndicators.has(key) ? 'text-white' : 'text-zinc-500 hover:text-zinc-300',
                )}
                style={{
                  backgroundColor: activeIndicators.has(key) ? config.color + '25' : 'transparent',
                  borderWidth: 1,
                  borderColor: activeIndicators.has(key) ? config.color + '50' : 'transparent',
                }}
              >
                {config.label}
              </button>
            ),
          )}
        </div>
      </div>

      {/* Chart container */}
      <div ref={containerRef} className="relative min-h-[300px] w-full flex-1" />
    </div>
  );
}
