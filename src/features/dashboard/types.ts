export type FileChangeStats = { additionsCount: number; deletionsCount: number }

export type FilesTouchedEntry = {
  filepath: string
  additionsCount: number
  deletionsCount: number
}

export type Checkpoint = {
  id: string
  prompt?: string
  firstPromptPreview?: string
  timestamp: string
  createdAt?: string
  branch?: string
  agent?: string
  strategy?: string
  sessionId?: string
  toolUseId?: string
  filesTouched?: FilesTouchedEntry[]
  sessionCount?: number
  checkpointsCount?: number
  isTask?: boolean
  commit?: string
  commitMessage?: string
}

export type CommitData = {
  date: string
  commit: string
  checkpoints: number
  message: string
  author?: string
  agent: string
  agents?: string[]
  checkpointList: Checkpoint[]
}

export type LoadState = 'loading' | 'api' | 'error'

export type CheckpointDetailLoadState = 'idle' | 'loading' | 'api' | 'error'

export type UserOption = {
  label: string
  value: string
}
