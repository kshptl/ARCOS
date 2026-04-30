export interface SparklineProps {
  values: number[];
  ariaLabel?: string;
  width?: number;
  height?: number;
}

export function Sparkline({ values, ariaLabel, width = 120, height = 32 }: SparklineProps) {
  if (values.length === 0) {
    return <svg width={width} height={height} aria-label={ariaLabel} role="img" />;
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = width / Math.max(1, values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
    >
      <polyline fill="none" stroke="var(--accent-hot)" strokeWidth="1.5" points={points} />
    </svg>
  );
}
