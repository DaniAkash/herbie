const PREVIEW_TITLE_LENGTH = 56
const PREVIEW_DESCRIPTION_LENGTH = 88

/** Cuts at the last word boundary, unless that would lose a third of it. */
function truncateMessageText(text: string, limit: number) {
  if (text.length <= limit) return text
  const excerpt = text.slice(0, limit)
  const boundary = excerpt.lastIndexOf(' ')
  return `${excerpt.slice(0, boundary > limit * 0.65 ? boundary : limit).trim()}…`
}

function getMessageText(message: HTMLElement) {
  const surface =
    message.querySelector<HTMLElement>(
      '[data-slot="message-bubble-content"]',
    ) ??
    message.querySelector<HTMLElement>('[data-slot="message-content"]') ??
    message
  return (surface.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * A rail entry's title and subtitle, scraped from the rendered message.
 *
 * A short message is its own title, and the reply that followed it becomes the
 * subtitle, since the title alone would not say what came of it. A long one
 * supplies both from itself.
 */
function getMessagePreview(
  message: HTMLElement,
  assistantResponse?: HTMLElement,
) {
  const text = getMessageText(message)
  if (!text) return { label: 'Message', description: undefined }

  if (text.length <= PREVIEW_TITLE_LENGTH) {
    const responseText = assistantResponse
      ? getMessageText(assistantResponse)
      : ''
    return {
      label: text,
      description: responseText
        ? truncateMessageText(responseText, PREVIEW_DESCRIPTION_LENGTH)
        : undefined,
    }
  }

  const titleExcerpt = text.slice(0, PREVIEW_TITLE_LENGTH)
  const titleBoundary = titleExcerpt.lastIndexOf(' ')
  const titleEnd =
    titleBoundary > PREVIEW_TITLE_LENGTH * 0.65
      ? titleBoundary
      : PREVIEW_TITLE_LENGTH
  const responseText = assistantResponse
    ? getMessageText(assistantResponse)
    : text.slice(titleEnd).trim()

  return {
    label: `${text.slice(0, titleEnd).trim()}…`,
    description: responseText
      ? truncateMessageText(responseText, PREVIEW_DESCRIPTION_LENGTH)
      : undefined,
  }
}

/**
 * Which rail entry the viewport is looking at.
 *
 * The two ends are special-cased: within the follow threshold of either edge
 * the first or last entry wins outright, so scrolling to the very top or
 * bottom always lights the entry the reader expects rather than whichever
 * message happens to be nearest the middle.
 */
export function nearestRailId(
  viewport: HTMLElement,
  targets: [string, HTMLElement][],
  followThreshold: number,
) {
  if (viewport.scrollTop <= followThreshold) return targets[0]?.[0] ?? ''

  const distanceFromEnd =
    viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
  if (distanceFromEnd <= followThreshold) return targets.at(-1)?.[0] ?? ''

  const rect = viewport.getBoundingClientRect()
  const centre = rect.top + rect.height / 2
  let nearestId = targets[0]?.[0] ?? ''
  let nearest = Number.POSITIVE_INFINITY
  for (const [id, element] of targets) {
    const box = element.getBoundingClientRect()
    const distance = Math.abs(box.top + box.height / 2 - centre)
    if (distance < nearest) {
      nearest = distance
      nearestId = id
    }
  }
  return nearestId
}

/**
 * The rail entries, read off the rendered transcript.
 *
 * Ids are held against the message elements themselves rather than their
 * index, so an entry keeps its identity while messages arrive above it.
 */
export function buildRailItems(
  content: HTMLElement,
  viewport: HTMLElement,
  ids: WeakMap<HTMLElement, string>,
  nextId: () => string,
) {
  const messages = Array.from(
    content.querySelectorAll<HTMLElement>('[data-slot="message"]'),
  )
  const targets = new Map<string, HTMLElement>()
  const items = messages.map((message, index) => {
    let id = ids.get(message)
    if (!id) {
      id = nextId()
      ids.set(message, id)
    }
    targets.set(id, message)
    const sender = message.dataset.from ?? 'conversation'
    const response =
      sender === 'user'
        ? messages
            .slice(index + 1)
            .find((candidate) => candidate.dataset.from === 'assistant')
        : undefined
    const preview = getMessagePreview(message, response)
    return {
      id,
      label: preview.label,
      description: preview.description,
      ariaLabel: `Go to ${sender} message ${index + 1} of ${messages.length}`,
    }
  })

  return {
    items,
    targets,
    overflowing:
      viewport.scrollHeight > viewport.clientHeight + 1 && messages.length > 1,
  }
}
