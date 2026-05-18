import { FileIcon, ImageIcon, Music2Icon, XIcon } from 'lucide-react'

// Small pill rendered above the composer textarea for each staged
// attachment (uploaded or still-pending-upload). Drives just the
// visual + the remove affordance — staging / unstaging lives in the
// Composer.
export function AttachmentChip({
  filename,
  mimeType,
  blobUrl,
  onRemove,
}: {
  filename: string
  mimeType: string
  blobUrl: string
  onRemove: () => void
}) {
  const isImage = mimeType.startsWith('image/')
  const isAudio = mimeType.startsWith('audio/')
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/40 py-1 pr-1 pl-2 text-xs">
      {isImage ? (
        <img
          src={blobUrl}
          alt={filename}
          className="size-6 rounded object-cover"
        />
      ) : isAudio ? (
        <Music2Icon className="size-3.5 text-muted-foreground" />
      ) : mimeType === 'application/octet-stream' ? (
        <FileIcon className="size-3.5 text-muted-foreground" />
      ) : (
        <ImageIcon className="size-3.5 text-muted-foreground" />
      )}
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
