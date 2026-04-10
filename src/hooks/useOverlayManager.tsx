/* eslint-disable react-refresh/only-export-components */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

interface OverlayEntry {
  id: string
  close: () => void
}

interface OverlayManagerValue {
  isAnyOverlayOpen: boolean
  openOverlay: (id: string, close: () => void) => void
  closeOverlay: (id: string) => void
  /** Close the most recently opened overlay. Used by the popstate handler only. */
  closeTopOverlay: () => boolean
  overlayCount: number
}

const OverlayContext = createContext<OverlayManagerValue | null>(null)

export function OverlayProvider({ children }: { children: React.ReactNode }) {
  // Stack of open overlays (index 0 = oldest, last = most recent / top)
  const [stack, setStack] = useState<OverlayEntry[]>([])
  // Guard against rapid back-press storms
  const debounceRef = useRef(false)
  // Guard against re-entrant popstate when we call replaceState ourselves
  const skipRef = useRef(false)

  const overlayCount = stack.length
  const isAnyOverlayOpen = overlayCount > 0

  // ─── Open ─────────────────────────────────────────────────────────────────
  const openOverlay = useCallback((id: string, close: () => void) => {
    setStack(prev => {
      if (prev.some(e => e.id === id)) return prev
      const next = [...prev, { id, close }]
      // Push one history entry when the FIRST overlay opens.
      // All subsequent overlays share this entry — one back-press per overlay,
      // and the browser navigates only when the stack is finally empty.
      if (prev.length === 0) {
        window.history.pushState({ __overlay: true }, '')
      }
      return next
    })
  }, [])

  // ─── Close (user-initiated: X button, Cancel, overlay's own close) ─────
  // Just removes the entry from the stack. No history manipulation here.
  // The next back-press hits the entry we pushed on first open, and the
  // popstate handler closes the remaining overlay(s) via replaceState.
  const closeOverlay = useCallback((id: string) => {
    setStack(prev => prev.filter(e => e.id !== id))
  }, [])

  // ─── Close top (called only by the popstate interceptor) ─────────────────
  const closeTopOverlay = useCallback((): boolean => {
    let closed = false
    setStack(prev => {
      if (prev.length === 0) return prev
      const [top, ...rest] = [...prev].reverse()
      top.close()
      closed = true
      return rest.reverse()
    })
    return closed
  }, [])

  // ─── Global popstate interceptor ──────────────────────────────────────────
  useEffect(() => {
    const handlePopState = () => {
      // Skip if we triggered this ourselves via replaceState
      if (skipRef.current) return

      // Debounce rapid back presses
      if (debounceRef.current) return
      debounceRef.current = true
      setTimeout(() => { debounceRef.current = false }, 300)

      setStack(prev => {
        if (prev.length > 0) {
          // Overlays are open — close the top one and keep the history entry
          // alive via replaceState so the browser doesn't consume a slot.
          // The user needs one back-press per overlay before real navigation.
          const [top, ...rest] = [...prev].reverse()
          top.close()
          const next = rest.reverse()

          skipRef.current = true
          window.history.replaceState({ __overlay: true }, '')
          setTimeout(() => { skipRef.current = false }, 0)
          return next
        }
        // Stack is empty — allow the browser's default navigation.
        return prev
      })
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, []) // stable — no reactive deps

  const value: OverlayManagerValue = {
    isAnyOverlayOpen,
    openOverlay,
    closeOverlay,
    closeTopOverlay,
    overlayCount,
  }

  return (
    <OverlayContext.Provider value={value}>
      {children}
    </OverlayContext.Provider>
  )
}

/**
 * Hook for overlay-aware components.
 *
 * Usage:
 *
 *   const { openOverlay, closeOverlay } = useOverlay()
 *
 *   useEffect(() => {
 *     if (isOpen) {
 *       openOverlay('my-overlay-id', () => setIsOpen(false))
 *     } else {
 *       closeOverlay('my-overlay-id')
 *     }
 *   }, [isOpen])
 *
 * The overlay id must be unique across the entire app.
 */
export function useOverlay(): OverlayManagerValue {
  const ctx = useContext(OverlayContext)
  if (!ctx) {
    throw new Error('useOverlay must be used inside <OverlayProvider>')
  }
  return ctx
}
