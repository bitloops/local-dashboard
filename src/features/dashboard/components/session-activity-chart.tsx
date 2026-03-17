import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { type CommitData } from '../types'

type CommitCheckpointChartProps = {
  data: CommitData[]
  onCommitClick?: (commit: string) => void
}

export function CommitCheckpointChart({
  data,
  onCommitClick,
}: CommitCheckpointChartProps) {
  const chronologicalData = [...data].reverse()
  return (
    <ResponsiveContainer width='100%' height={300}>
      <AreaChart
        data={chronologicalData}
        onClick={(state) => {
          const payload = (
            state as { activePayload?: { payload: CommitData }[] }
          )?.activePayload
          if (payload?.[0]?.payload?.commit) {
            onCommitClick?.(payload[0].payload.commit)
          }
        }}
      >
        <defs>
          <linearGradient id='checkpointFill' x1='0' y1='0' x2='0' y2='1'>
            <stop offset='0%' stopColor='#7404E4' stopOpacity={0.6} />
            <stop offset='100%' stopColor='#7404E4' stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray='3 3' className='stroke-muted' />
        <XAxis
          dataKey='date'
          stroke='#ffffff'
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke='#ffffff'
          fontSize={12}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          label={{
            value: 'Checkpoints',
            angle: -90,
            position: 'insideLeft',
            style: { fill: '#ffffff', fontSize: 12 },
          }}
        />
        <Tooltip
          cursor={{
            stroke: 'hsl(var(--foreground))',
            strokeWidth: 1,
            strokeDasharray: '4 4',
          }}
          contentStyle={{
            backgroundColor: 'hsl(var(--popover))',
            borderColor: 'hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
          itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
          formatter={(value: number | undefined) => [
            `${value ?? 0}`,
            'Checkpoints',
          ]}
          labelFormatter={(_label, payload) => {
            if (payload?.[0]?.payload) {
              const p = payload[0].payload as CommitData
              return `${p.date}  ·  commit ${p.commit}`
            }
            return String(_label)
          }}
        />
        <Area
          type='natural'
          dataKey='checkpoints'
          stroke='hsl(var(--foreground))'
          fill='url(#checkpointFill)'
          strokeWidth={3}
          dot={false}
          activeDot={{
            r: 6,
            fill: '#888888',
            stroke: '#ffffff',
            strokeWidth: 3,
            cursor: 'pointer',
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
