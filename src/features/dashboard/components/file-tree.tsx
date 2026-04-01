import { File, Folder } from 'lucide-react'

export type FileChangeStats = { additionsCount: number; deletionsCount: number }
export type FileChangeStatsEntry = FileChangeStats & { filepath: string }

type FileTreeNode = {
  name: string
  children: Map<string, FileTreeNode>
  isFile: boolean
  /** Full path and stats only on file nodes when built from fileStats */
  fullPath?: string
  additionsCount?: number
  deletionsCount?: number
}

function buildFileTreeFromPaths(paths: string[]): FileTreeNode {
  const root: FileTreeNode = { name: '', children: new Map(), isFile: false }

  for (const filePath of paths) {
    const parts = filePath.split('/')
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1

      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          children: new Map(),
          isFile,
          ...(isFile ? { fullPath: filePath } : {}),
        })
      }

      current = current.children.get(part)!
    }
  }

  return root
}

function buildFileTreeFromStats(
  fileStats: FileChangeStatsEntry[],
): FileTreeNode {
  const root: FileTreeNode = { name: '', children: new Map(), isFile: false }

  for (const {
    filepath: filePath,
    additionsCount,
    deletionsCount,
  } of fileStats) {
    const parts = filePath.split('/')
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1

      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          children: new Map(),
          isFile,
          ...(isFile
            ? {
                fullPath: filePath,
                additionsCount,
                deletionsCount,
              }
            : {}),
        })
      }

      current = current.children.get(part)!
    }
  }

  return root
}

function FileTreeBranch({
  node,
  depth = 0,
}: {
  node: FileTreeNode
  depth?: number
}) {
  const sorted = Array.from(node.children.values()).sort((a, b) => {
    if (a.isFile === b.isFile) return a.name.localeCompare(b.name)
    return a.isFile ? 1 : -1
  })

  return (
    <>
      {sorted.map((child, index) => {
        const isLast = index === sorted.length - 1

        return (
          <div key={child.name} className='relative'>
            {depth > 0 && (
              <>
                <div
                  className='absolute top-0 border-l border-border'
                  style={{
                    left: `${(depth - 1) * 20 + 9}px`,
                    height: isLast ? '14px' : '100%',
                  }}
                />
                <div
                  className='absolute border-t border-border'
                  style={{
                    left: `${(depth - 1) * 20 + 9}px`,
                    top: '14px',
                    width: '11px',
                  }}
                />
              </>
            )}
            <div
              className='flex min-w-0 items-center gap-1.5 py-0.5 text-sm'
              style={{ paddingLeft: `${depth * 20}px` }}
            >
              {child.isFile ? (
                <File className='size-4 shrink-0 text-muted-foreground' />
              ) : (
                <Folder className='size-4 shrink-0 text-muted-foreground' />
              )}
              <span
                className={
                  child.isFile
                    ? 'min-w-0 break-all text-foreground'
                    : 'min-w-0 break-all font-medium text-foreground'
                }
              >
                {child.name}
              </span>
              {child.isFile &&
                (child.additionsCount !== undefined ||
                  child.deletionsCount !== undefined) && (
                  <span className='ml-1 flex items-center gap-1 font-mono text-xs'>
                    {child.additionsCount !== undefined &&
                      child.additionsCount > 0 && (
                        <span className='text-emerald-600 dark:text-emerald-400'>
                          +{child.additionsCount}
                        </span>
                      )}
                    {child.deletionsCount !== undefined &&
                      child.deletionsCount > 0 && (
                        <span className='text-red-600 dark:text-red-400'>
                          −{child.deletionsCount}
                        </span>
                      )}
                  </span>
                )}
            </div>
            {!child.isFile && child.children.size > 0 && (
              <FileTreeBranch node={child} depth={depth + 1} />
            )}
          </div>
        )
      })}
    </>
  )
}

type FileTreeProps =
  | { paths: string[]; fileStats?: never }
  | { paths?: never; fileStats: FileChangeStatsEntry[] }

export function FileTree(props: FileTreeProps) {
  const node =
    'fileStats' in props && props.fileStats
      ? buildFileTreeFromStats(props.fileStats)
      : buildFileTreeFromPaths(props.paths)
  return <FileTreeBranch node={node} />
}
