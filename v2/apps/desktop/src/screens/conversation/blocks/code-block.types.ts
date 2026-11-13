/** A single run of code within a diff row; `change` tints it as an add or del. */
export interface CodePiece {
  text: string
  change?: 'add' | 'del'
}

/** One row of a unified diff: old and new line numbers, its kind, its pieces. */
export interface DiffRow {
  old: number | null
  cur: number | null
  type: 'ctx' | 'add' | 'del'
  pieces: CodePiece[]
}

export type CodeBlockProps = {
  filename: string
} & ({ diff: DiffRow[]; lines?: never } | { lines: string[]; diff?: never })
