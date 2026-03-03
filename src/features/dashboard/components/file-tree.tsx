import { File, Folder } from 'lucide-react'

type FileTreeNode = {
  name: string
  children: Map<string, FileTreeNode>
  isFile: boolean
}

function buildFileTree(paths: string[]): FileTreeNode {
  const root: FileTreeNode = { name: '', children: new Map(), isFile: false }

  for (const filePath of paths) {
    const parts = filePath.split('/')
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1

      if (!current.children.has(part)) {
        current.children.set(part, { name: part, children: new Map(), isFile })
      }

      current = current.children.get(part)!
    }
  }

  return root
}

function FileTreeBranch({ node, depth = 0 }: { node: FileTreeNode; depth?: number }) {
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
              className='flex items-center gap-1.5 py-0.5 text-sm'
              style={{ paddingLeft: `${depth * 20}px` }}
            >
              {child.isFile ? (
                <File className='size-4 shrink-0 text-muted-foreground' />
              ) : (
                <Folder className='size-4 shrink-0 text-muted-foreground' />
              )}
              <span className={child.isFile ? 'text-foreground' : 'font-medium text-foreground'}>
                {child.name}
              </span>
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

export function FileTree({ paths }: { paths: string[] }) {
  return <FileTreeBranch node={buildFileTree(paths)} />
}
