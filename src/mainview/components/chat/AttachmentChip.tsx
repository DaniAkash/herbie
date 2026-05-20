import { XIcon } from 'lucide-react'

// Small pill rendered above the composer textarea for each staged
// attachment (uploaded or still-pending-upload). Attachments are
// images-only today — the backend `mimeAllowed` rejects everything
// else and the file input narrows the picker — so the chip just
// renders a thumbnail. Audio / generic-file branches can return when
// those mime gates do.
export function AttachmentChip({
  filename,
  blobUrl,
  onRemove,
}: {
  filename: string
  blobUrl: string
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/40 py-1 pr-1 pl-2 text-xs">
      <img
        src={blobUrl}
        alt={filename}
        className="size-6 rounded object-cover"
      />
      <span className="max-w-[180px] truncate font-medium">{filename}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${filename}`}
        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <XIcon className="size-3" />
      </button>
    </div>
  )
}
