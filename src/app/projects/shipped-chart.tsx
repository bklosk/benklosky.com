import { area, curveMonotoneX, line, max, scaleLinear, scaleTime, timeFormat, timeMonth } from "d3";

type Point = { date: Date; value: number };

const points: Point[] = [
  [2025, 10, 1],
  [2025, 11, 2],
  [2026, 0, 2],
  [2026, 1, 3],
  [2026, 2, 2],
  [2026, 3, 4],
  [2026, 4, 3],
  [2026, 5, 5],
  [2026, 6, 4],
  [2026, 7, 6],
  [2026, 8, 5],
  [2026, 9, 7],
].map(([year, month, value]) => ({ date: new Date(year, month, 1), value }));

const width = 352;
const height = 128;
const margin = { top: 8, right: 16, bottom: 22, left: 16 };

export function ShippedChart() {
  const x = scaleTime()
    .domain([points[0].date, points[points.length - 1].date])
    .range([margin.left, width - margin.right]);
  const y = scaleLinear()
    .domain([0, max(points, (point) => point.value) ?? 0])
    .range([height - margin.bottom, margin.top]);
  const curve = curveMonotoneX;
  const linePath = line<Point>().x((point) => x(point.date)).y((point) => y(point.value)).curve(curve);
  const areaPath = area<Point>()
    .x((point) => x(point.date))
    .y0(y(0))
    .y1((point) => y(point.value))
    .curve(curve);
  const ticks = timeMonth.every(2)!.range(points[0].date, points[points.length - 1].date);
  const formatMonth = timeFormat("%b");

  return (
    <svg className="shipped-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Placeholder chart of things shipped over time">
      <path className="shipped-chart-area" d={areaPath(points) ?? undefined} />
      <path className="shipped-chart-line" d={linePath(points) ?? undefined} />
      {ticks.map((tick) => (
        <text key={tick.toISOString()} x={x(tick)} y={height - 4} textAnchor="middle">
          {formatMonth(tick)}
        </text>
      ))}
    </svg>
  );
}
