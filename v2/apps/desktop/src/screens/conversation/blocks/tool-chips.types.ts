export interface ToolDetailLine {
  text: string
  tone?: 'add'
}

export interface ToolStep {
  icon: string
  label: string
  chip: string
  mono: boolean
  detailMono: boolean
  detail: ToolDetailLine[]
}

export interface ToolDiff {
  file: string
  add: number
  del: number
}

export interface ToolDiffLine {
  text: string
  tone: 'add' | 'del' | 'ctx'
}

/** Where a hovered file chip's diff preview is pinned, in viewport pixels. */
export interface DiffPreviewAt {
  file: string
  x: number
  top?: number
  bottom?: number
}
