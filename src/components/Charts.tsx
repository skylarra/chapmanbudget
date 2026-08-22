
export function BarChart({
  labels,
  series,
}: {
  labels: string[];
  series: { name: string; values: number[]; color: string }[];
}) {
  const max = Math.max(1, ...series.flatMap((s) => s.values.map((v) => Math.abs(v))));
  const w = 640;
  const h = 220;
  const pad = 28;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const group = innerW / Math.max(1, labels.length);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Bar chart" style={{ width: "100%", height: "auto" }}>
      {series.map((s, si) =>
        s.values.map((v, i) => {
          const bh = (Math.abs(v) / max) * innerH;
          const bw = group / (series.length + 0.6);
          const x = pad + i * group + si * bw + 8;
          const y = pad + innerH - bh;
          return <rect key={`${si}-${i}`} x={x} y={y} width={bw} height={bh} rx={4} fill={s.color} opacity={0.9} />;
        }),
      )}
      {labels.map((label, i) => (
        <text key={label} x={pad + i * group + group / 2} y={h - 8} textAnchor="middle" fontSize="11" fill="currentColor">
          {label.replace(/^\w+\s/, "").slice(0, 7)}
        </text>
      ))}
    </svg>
  );
}

export function LineChart({ labels, values, color = "#1f6f5b" }: { labels: string[]; values: number[]; color?: string }) {
  const max = Math.max(1, ...values.map((v) => Math.abs(v)));
  const w = 640;
  const h = 200;
  const pad = 24;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const pts = values.map((v, i) => {
    const x = pad + (i / Math.max(1, values.length - 1)) * innerW;
    const y = pad + innerH - (Math.max(0, v) / max) * innerH;
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Line chart" style={{ width: "100%", height: "auto" }}>
      <polyline fill="none" stroke={color} strokeWidth="3" points={pts.join(" ")} />
      {values.map((v, i) => {
        const x = pad + (i / Math.max(1, values.length - 1)) * innerW;
        const y = pad + innerH - (Math.max(0, v) / max) * innerH;
        return <circle key={i} cx={x} cy={y} r="4" fill={color} />;
      })}
      {labels.map((label, i) => (
        <text key={label + i} x={pad + (i / Math.max(1, labels.length - 1)) * innerW} y={h - 6} textAnchor="middle" fontSize="11" fill="currentColor">
          {label.slice(0, 8)}
        </text>
      ))}
    </svg>
  );
}
