'use client';

interface SectorData {
  sector: string;
  value: number;
  color: string;
}

interface SectorAllocationProps {
  data: SectorData[];
}

export function SectorAllocation({ data }: SectorAllocationProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <p className="py-8 text-center text-sm text-muted-foreground">No allocation data</p>;

  // Build conic-gradient segments
  let cumulative = 0;
  const gradientStops = data.flatMap((d) => {
    const start = cumulative;
    const pct = (d.value / total) * 100;
    cumulative += pct;
    return [`${d.color} ${start.toFixed(2)}%`, `${d.color} ${cumulative.toFixed(2)}%`];
  });

  const gradient = `conic-gradient(${gradientStops.join(', ')})`;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Donut */}
      <div className="relative h-48 w-48">
        <div
          className="h-full w-full rounded-full"
          style={{ background: gradient }}
        />
        <div className="absolute inset-0 m-auto h-28 w-28 rounded-full bg-zinc-950" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-sm font-bold font-[family-name:var(--font-geist-mono)]">
              ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
        {data.map((d) => (
          <div key={d.sector} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-muted-foreground">{d.sector}</span>
            <span className="ml-auto font-[family-name:var(--font-geist-mono)] text-foreground">
              {((d.value / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
