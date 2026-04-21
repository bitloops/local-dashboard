import { VariablesPanel } from '@/features/query-explorer/components/variables-panel'

type SessionsVariablesPanelProps = {
  value: string
  onChange: (value: string) => void
  onValidationChange?: (hasErrors: boolean) => void
  className?: string
  /** Editor fills vertical space next to the query editor. */
  fillHeight?: boolean
}

/** JSON variables editor (`repoId`, `filter.branch`, `limit`, `offset`; repo/branch dropdowns stay in sync). */
export function SessionsVariablesPanel({
  value,
  onChange,
  onValidationChange,
  className,
  fillHeight = false,
}: SessionsVariablesPanelProps) {
  return (
    <VariablesPanel
      value={value}
      onChange={onChange}
      onValidationChange={onValidationChange}
      className={className}
      fillHeight={fillHeight}
    />
  )
}
