import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface Props {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
}

export function SparklineChart({ data, color = '#3b82f6', height = 36, width = 80 }: Props) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width={width} height={height}>
      <LineChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
