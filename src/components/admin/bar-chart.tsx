/** Mini graphique en barres SVG, sans dépendance externe (§49 "graphiques"). */
export function BarChart({ points }: { points: { label: string; value: number }[] }) {
  const max = Math.max(1, ...points.map((point) => point.value));
  const width = 100;
  const height = 40;
  const barWidth = width / points.length;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-full" preserveAspectRatio="none">
        {points.map((point, index) => {
          const barHeight = (point.value / max) * (height - 2);
          return (
            <rect
              key={point.label}
              x={index * barWidth + barWidth * 0.15}
              y={height - barHeight}
              width={barWidth * 0.7}
              height={barHeight}
              className="fill-brand-500"
            />
          );
        })}
      </svg>
      <div className="mt-1 flex text-xs text-foreground/70">
        {points.map((point) => (
          <span key={point.label} className="flex-1 text-center">
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}
