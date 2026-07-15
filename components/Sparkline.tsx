export function Sparkline({ data, width = 96, height = 28 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) {
    return <div style={{ width, height }} />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data.map((v, i) => `${(i * stepX).toFixed(2)},${(height - ((v - min) / range) * height).toFixed(2)}`);
  const isUp = data[data.length - 1] >= data[0];
  const color = isUp ? "var(--green)" : "var(--red)";

  const areaPoints = [`0,${height}`, ...points, `${width},${height}`].join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polygon points={areaPoints} fill={color} opacity={0.08} />
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
