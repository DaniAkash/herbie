import notifier from 'node-notifier'
import electrobunConfig from '../../../electrobun.config'

// Sender bundle id makes the toast appear under Herbie's name in
// Notification Center instead of "terminal-notifier" (node-notifier's
// bundled helper, which would otherwise leak its own identity).
const SENDER_BUNDLE_ID = electrobunConfig.app.identifier

export type NotifyCategory = 'chat-reply' | 'chat-permission' | 'task'

export interface NotifyArgs {
  id: string
  title: string
  body: string
  silent: boolean
  category: NotifyCategory
}

export function notify({ id, title, body, silent }: NotifyArgs): void {
  notifier.notify({
    title,
    message: body,
    sound: silent ? false : 'Glass',
    sender: SENDER_BUNDLE_ID,
    wait: false,
    // node-notifier surfaces this back on the 'click' event so we can
    // route to the right action without parsing title/body.
    // biome-ignore lint/suspicious/noExplicitAny: terminal-notifier extras are loose
    ...({ id } as any),
  })
}

type ClickHandler = (id: string) => void
const handlers = new Set<ClickHandler>()

notifier.on('click', (_obj, options) => {
  const opts = options as { id?: string } | undefined
  if (!opts?.id) return
  for (const h of handlers) {
    try {
      h(opts.id)
    } catch {
      // One handler throwing must not break others.
    }
  }
})

export function onNotificationClick(handler: ClickHandler): () => void {
  handlers.add(handler)
  return () => {
    handlers.delete(handler)
  }
}
