import type { CountyMetadata } from '@/lib/data/schemas';
import { formatFull } from '@/lib/format/number';

export interface MapTooltipProps {
  county: CountyMetadata | null;
  value: number | null;
  metricLabel: string;
  year: number;
  x: number;
  y: number;
}

export function MapTooltip({ county, value, metricLabel, year, x, y }: MapTooltipProps) {
  if (!county) return null;
  return (
    <div
      role="tooltip"
      style={{
        position: 'absolute',
        left: x + 12,
        top: y + 12,
        pointerEvents: 'none',
        background: 'var(--canvas)',
        border: '1px solid var(--ink)',
        padding: '6px 10px',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--type-body-sm)',
        fontVariantNumeric: 'tabular-nums',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      <div style={{ fontWeight: 600 }}>
        {county.name}, {county.state}
      </div>
      <div style={{ color: 'var(--text-muted)' }}>
        {metricLabel} {year}
      </div>
      <div style={{ fontSize: 'var(--type-body)' }}>
        {value == null ? '—' : formatFull(value)}
      </div>
    </div>
  );
}
