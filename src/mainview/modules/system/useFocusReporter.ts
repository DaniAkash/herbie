import { useLocation } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useReportFocus } from '@/modules/api/focus.hooks'

// Pathname for an existing-chat route is /chat/<id> where id is not
// 'new'. /chat/new is a different file route with no conversation
// row, so it does not count as "viewing a conversation".
function activeConversationId(pathname: string): string | null {
  const m = pathname.match(/^\/chat\/([^/]+)$/)
  if (!m) return null
  if (m[1] === 'new') return null
  return m[1]
}

// Top-level hook. Reports the focused conversation to bun so the
// notification dispatcher can suppress toasts when the user is already
// looking at the chat, and so the lastSeenAt bumper knows when to fire.
// Focused means: visible tab AND window has OS focus AND we are on
// /chat/<id> for an existing conversation.
export function useFocusReporter(): void {
  const { pathname } = useLocation()
  const [hasOsFocus, setHasOsFocus] = useState<boolean>(() =>
    typeof document === 'undefined' ? true : document.hasFocus(),
  )
  const [isVisible, setIsVisible] = useState<boolean>(() =>
    typeof document === 'undefined'
      ? true
      : document.visibilityState === 'visible',
  )
  const { mutate } = useReportFocus()

  useEffect(() => {
    function onFocus() {
      setHasOsFocus(true)
    }
    function onBlur() {
      setHasOsFocus(false)
    }
    function onVisibility() {
      setIsVisible(document.visibilityState === 'visible')
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const focusedConversationId =
    hasOsFocus && isVisible ? activeConversationId(pathname) : null

  // Mirror in a ref so we POST only when the derived value actually
  // changes. Without the ref, every render that recomputes the derived
  // value to the same id would fire a redundant POST.
  const lastReported = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    if (lastReported.current === focusedConversationId) return
    lastReported.current = focusedConversationId
    mutate({ conversationId: focusedConversationId })
  }, [focusedConversationId, mutate])
}
