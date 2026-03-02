import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { ApiTokenUsageDto } from '@/api/types/schema'

const COLORS = {
  input: '#7c3aed',
  output: '#2dd4bf',
  cacheRead: '#f59e0b',
  cacheCreate: '#f43f5e',
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

type TokenUsageChartProps = {
  usage: ApiTokenUsageDto
}

export function TokenUsageChart({ usage }: TokenUsageChartProps) {
  const segments = [
    { name: 'Input', value: usage.input_tokens, color: COLORS.input },
    { name: 'Output', value: usage.output_tokens, color: COLORS.output },
    { name: 'Cache Read', value: usage.cache_read_tokens, color: COLORS.cacheRead },
    { name: 'Cache Create', value: usage.cache_creation_tokens, color: COLORS.cacheCreate },
  ].filter((s) => s.value > 0)

  const total = usage.input_tokens + usage.output_tokens + usage.cache_read_tokens + usage.cache_creation_tokens

  return (
    <div className='grid grid-cols-[180px_1fr] items-center gap-3'>
      <ResponsiveContainer width={140} height={140}>
        <PieChart>
          <Pie
            data={segments}
            dataKey='value'
            cx='50%'
            cy='50%'
            innerRadius={38}
            outerRadius={62}
            strokeWidth={2}
            stroke='hsl(var(--card))'
          >
            {segments.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              borderColor: 'hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
            itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
            formatter={(value: number | undefined) => [formatNumber(value ?? 0), '']}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className='space-y-1.5'>
        <p className='text-lg font-bold text-primary'>{formatNumber(total)}</p>
        <p className='text-[11px] text-muted-foreground'>total tokens</p>
        <div className='mt-2 space-y-1'>
          {segments.map((s) => (
            <div key={s.name} className='flex items-center gap-2 text-xs'>
              <span
                className='inline-block h-2.5 w-2.5 shrink-0 rounded-full'
                style={{ backgroundColor: s.color }}
              />
              <span className='text-muted-foreground'>{s.name}</span>
              <span className='ml-auto font-mono'>{formatNumber(s.value)}</span>
            </div>
          ))}
          <div className='flex items-center gap-2 border-t pt-1 text-xs'>
            <span className='text-muted-foreground'>API Calls</span>
            <span className='ml-auto font-mono'>{usage.api_call_count}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
