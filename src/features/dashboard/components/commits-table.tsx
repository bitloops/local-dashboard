import { useState, useEffect, Fragment } from 'react'
import {
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  type ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTablePagination, DataTableToolbar } from '@/components/data-table'
import {
  type CommitRow,
  commitColumns as columns,
} from './sessions-columns'
import { type Checkpoint } from '../data/mock-commit-data'

const agentOptions = [
  { label: 'Claude Code', value: 'claude-code' },
  { label: 'Gemini CLI', value: 'gemini-cli' },
  { label: 'OpenCode', value: 'open-code' },
]

type CommitTableProps = {
  data: CommitRow[]
  onCheckpointClick?: (checkpoint: Checkpoint) => void
}

function CheckpointTree({
  checkpoints,
  onCheckpointClick,
}: {
  checkpoints: Checkpoint[]
  onCheckpointClick?: (checkpoint: Checkpoint) => void
}) {
  const parentX = 12
  const childX = 36
  const rowH = 34
  const dotR = 5
  const parentDotR = 6
  const margin = 18
  const curveR = 14

  const topParentY = margin
  const firstDotY = topParentY + curveR + rowH / 2
  const lastDotY = firstDotY + (checkpoints.length - 1) * rowH
  const bottomParentY = lastDotY + curveR
  const totalH = bottomParentY + margin

  return (
    <div className='relative overflow-hidden pe-4' style={{ paddingLeft: childX + 22, margin: '4px 0' }}>
      <svg
        className='pointer-events-none absolute'
        style={{ left: 14, top: 0 }}
        width={childX + 14}
        height={totalH}
      >
        {/* Parent rail — between the two parent dots (background color) */}
        <line
          x1={parentX} y1={topParentY}
          x2={parentX} y2={bottomParentY}
          stroke='var(--background)'
          strokeWidth={3}
          strokeLinecap='round'
        />

        {/* Top connector: horizontal from parent → smooth arc down into child rail */}
        <line
          x1={parentX} y1={topParentY}
          x2={childX - curveR} y2={topParentY}
          stroke='#7404E4'
          strokeWidth={2}
          strokeLinecap='round'
        />
        <path
          d={`M ${childX - curveR},${topParentY} Q ${childX},${topParentY} ${childX},${topParentY + curveR}`}
          fill='none'
          stroke='#7404E4'
          strokeWidth={2}
          strokeLinecap='round'
        />

        {/* Child vertical rail */}
        <line
          x1={childX} y1={topParentY + curveR}
          x2={childX} y2={lastDotY}
          stroke='#7404E4'
          strokeWidth={2}
          strokeLinecap='round'
        />

        {/* Bottom connector: child rail curves left → horizontal back to parent */}
        <path
          d={`M ${childX},${lastDotY} Q ${childX},${bottomParentY} ${childX - curveR},${bottomParentY}`}
          fill='none'
          stroke='#7404E4'
          strokeWidth={2}
          strokeLinecap='round'
        />
        <line
          x1={childX - curveR} y1={bottomParentY}
          x2={parentX} y2={bottomParentY}
          stroke='#7404E4'
          strokeWidth={2}
          strokeLinecap='round'
        />

        {/* Orange dots on the child rail */}
        {checkpoints.map((_, i) => (
          <circle
            key={i}
            cx={childX}
            cy={firstDotY + i * rowH}
            r={dotR}
            fill='#7404E4'
          />
        ))}

        {/* Parent dot at top — bg mask, grey ring, bg center */}
        <circle cx={parentX} cy={topParentY} r={parentDotR + 2} fill='hsl(var(--background))' />
        <circle cx={parentX} cy={topParentY} r={parentDotR} fill='#555' />
        <circle cx={parentX} cy={topParentY} r={3.5} fill='hsl(var(--background))' />

        {/* Parent dot at bottom — bg mask, grey ring, bg center */}
        <circle cx={parentX} cy={bottomParentY} r={parentDotR + 2} fill='hsl(var(--background))' />
        <circle cx={parentX} cy={bottomParentY} r={parentDotR} fill='#555' />
        <circle cx={parentX} cy={bottomParentY} r={3.5} fill='hsl(var(--background))' />
      </svg>

      <ul role='tree' style={{ paddingTop: topParentY + curveR }}>
        {checkpoints.map((cp) => (
          <li key={cp.id} role='treeitem'>
            <button
              type='button'
              onClick={(e) => {
                e.stopPropagation()
                onCheckpointClick?.(cp)
              }}
              className={cn(
                'group flex w-full items-center gap-2.5 rounded-sm px-3',
                'text-left text-sm',
                'hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none',
                'transition-colors'
              )}
              style={{ height: rowH }}
            >
              <span className='min-w-0 flex-1 truncate text-muted-foreground group-hover:text-foreground'>
                {cp.prompt}
              </span>
              <span className='flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground'>
                <Clock className='size-3' />
                {cp.timestamp}
              </span>
            </button>
          </li>
        ))}
        <li aria-hidden style={{ height: margin + parentDotR }} />
      </ul>
    </div>
  )
}

export function CommitTable({ data, onCheckpointClick }: CommitTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = useState('')
  const [expanded, setExpanded] = useState<ExpandedState>({})
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setExpanded({})
    setSelectedRows({})
  }, [data])

  const table = useReactTable({
    data,
    columns,
    initialState: {
      pagination: { pageIndex: 0, pageSize: 10 },
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
      expanded,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onExpandedChange: (updater) => {
      setExpanded((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        if (typeof next === 'boolean') return next
        const prevObj = typeof prev === 'object' ? prev : {}
        const newlyExpanded = Object.keys(next).find(
          (key) => next[key] && !prevObj[key]
        )
        if (newlyExpanded) {
          setSelectedRows((old) => ({ ...old, [newlyExpanded]: true }))
          return { [newlyExpanded]: true }
        }
        return next
      })
    },
    globalFilterFn: (row, _columnId, filterValue) => {
      const commit = String(row.getValue('commit')).toLowerCase()
      const message = String(row.getValue('message')).toLowerCase()
      const date = String(row.getValue('date')).toLowerCase()
      const search = String(filterValue).toLowerCase()
      return (
        commit.includes(search) ||
        message.includes(search) ||
        date.includes(search)
      )
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  return (
    <div className={cn('flex flex-1 flex-col gap-4')}>
      <DataTableToolbar
        table={table}
        searchPlaceholder='Filter by commit, message, or date\u2026'
        filters={[
          {
            columnId: 'agent',
            title: 'Agent',
            options: agentOptions,
          },
        ]}
      />
      <div className='overflow-hidden rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className={cn(
                      header.column.columnDef.meta?.className,
                      header.column.columnDef.meta?.thClassName
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <Fragment key={row.id}>
                  <TableRow
                    className='cursor-pointer'
                    role='button'
                    tabIndex={0}
                    onClick={() => row.toggleExpanded()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        row.toggleExpanded()
                      }
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          cell.column.columnDef.meta?.className,
                          cell.column.columnDef.meta?.tdClassName
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow className='hover:bg-transparent'>
                    <TableCell
                      colSpan={columns.length}
                      className='border-none p-0'
                    >
                      <div
                        className='grid transition-[grid-template-rows] duration-300 ease-out'
                        style={{ gridTemplateRows: row.getIsExpanded() ? '1fr' : '0fr' }}
                      >
                        <div className='overflow-hidden' inert={!row.getIsExpanded() || undefined}>
                          {selectedRows[row.id] && (
                            <div className='border-b border-muted bg-muted/30'>
                              <CheckpointTree
                                checkpoints={row.original.checkpointList}
                                onCheckpointClick={onCheckpointClick}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                </Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  No commits found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  )
}
