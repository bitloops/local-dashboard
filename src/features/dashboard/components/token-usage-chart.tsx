import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { DashboardTokenUsageDto } from '../api-types'

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

const EMPTY_COLOR = '#7404E433'
const PLACEHOLDER = [{ name: 'No data', value: 1, color: EMPTY_COLOR }]

const ALL_SEGMENTS = [
  { name: 'Input', key: 'input_tokens' as const, color: COLORS.input },
  { name: 'Output', key: 'output_tokens' as const, color: COLORS.output },
  {
    name: 'Cache Read',
    key: 'cache_read_tokens' as const,
    color: COLORS.cacheRead,
  },
  {
    name: 'Cache Create',
    key: 'cache_creation_tokens' as const,
    color: COLORS.cacheCreate,
  },
]

type TokenUsageChartProps = {
  usage?: DashboardTokenUsageDto | null
}

export function TokenUsageChart({ usage }: TokenUsageChartProps) {
  const hasData = Boolean(usage)

  const segmentsRaw = hasData
    ? ALL_SEGMENTS.map((s) => ({
        name: s.name,
        value: usage![s.key],
        color: s.color,
      }))
    : []
  const segments =
    segmentsRaw.length > 0 && segmentsRaw.some((s) => s.value > 0)
      ? segmentsRaw.filter((s) => s.value > 0)
      : PLACEHOLDER

  const total = usage
    ? usage.input_tokens +
      usage.output_tokens +
      usage.cache_read_tokens +
      usage.cache_creation_tokens
    : 0

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
          {segments !== PLACEHOLDER && (
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                borderColor: 'hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
              itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
              formatter={(value: number | undefined) => [
                formatNumber(value ?? 0),
                '',
              ]}
            />
          )}
        </PieChart>
      </ResponsiveContainer>

      <div className='space-y-1.5'>
        <p className='text-lg font-bold text-primary'>
          {hasData ? formatNumber(total) : '-'}
        </p>
        <p className='text-[11px] text-muted-foreground'>total tokens</p>
        <div className='mt-2 space-y-1'>
          {ALL_SEGMENTS.map((s) => (
            <div key={s.name} className='flex items-center gap-2 text-xs'>
              <span
                className='inline-block size-2.5 shrink-0 rounded-full'
                style={{ backgroundColor: hasData ? s.color : EMPTY_COLOR }}
              />
              <span className='text-muted-foreground'>{s.name}</span>
              <span className='ml-auto font-mono'>
                {usage ? formatNumber(usage[s.key]) : '-'}
              </span>
            </div>
          ))}
          <div className='flex items-center gap-2 border-t pt-1 text-xs'>
            <span className='text-muted-foreground'>API Calls</span>
            <span className='ml-auto font-mono'>
              {usage ? usage.api_call_count : '-'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
