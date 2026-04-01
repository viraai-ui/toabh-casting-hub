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
  /** Close the most recently opened overlay. Returns true if an overlay was closed. */
  closeTopOverlay: () => boolean
  overlayCount: number
}

const OverlayContext = createContext<OverlayManagerValue | null>(null)

export function OverlayProvider({ children }: { children: React.ReactNode }) {
  // Stack of open overlays (top = most recent)
  const [stack, setStack] = useState<OverlayEntry[]>([])
  // Guard against rapid back-press storms
  const debounceRef = useRef(false)
  // Prevent popstate from double-triggering
  const isPopRef = useRef(false)

  const overlayCount = stack.length
  const isAnyOverlayOpen = overlayCount > 0

  // Open an overlay — push one history entry per distinct open action
  const openOverlay = useCallback((id: string, close: () => void) => {
    setStack(prev => {
      // Already registered — skip
      if (prev.some(e => e.id === id)) return prev
      return [...prev, { id, close }]
    })
  }, [])

  // Close a specific overlay by id
  const closeOverlay = useCallback((id: string) => {
    setStack(prev => {
      const next = prev.filter(e => e.id !== id)
      // If this was the last overlay, pop the history entry to stay in sync
      if (prev.length > 0 && next.length === 0) {
        // Use replaceState to avoid adding a new back entry just for closing
        window.history.replaceState(
          { __overlayCount: next.length, __overlay: true },
          ''
        )
      }
      return next
    })
  }, [])

  // Close the topmost overlay — used by popstate handler
  const closeTopOverlay = useCallback((): boolean => {
    let closed = false
    setStack(prev => {
      if (prev.length === 0) return prev
      const [top, ...rest] = [...prev].reverse()
      top.close()
      closed = true
      const next = rest.reverse()
      // Keep replaceState in sync so history.length doesn't grow
      window.history.replaceState(
        { __overlayCount: next.length, __overlay: true },
        ''
      )
      return next
    })
    return closed
  }, [])

  // ─── Core popstate interceptor ─────────────────────────────────────────────
  useEffect(() => {
    const handlePopState = (_evt: PopStateEvent) => {
      if (isPopRef.current) {
        isPopRef.current = false
        return
      }

      // Debounce rapid back presses
      if (debounceRef.current) return
      debounceRef.current = true
      setTimeout(() => { debounceRef.current = false }, 300)

      setStack(prev => {
        // Overlay(s) are open — close the topmost one instead of navigating
        if (prev.length > 0) {
          isPopRef.current = true // prevent re-entrant closeTopOverlay
          const [top, ...rest] = [...prev].reverse()
          top.close()
          const next = rest.reverse()

          // Re-push state so the browser history entry is consistent with overlayCount
          window.history.replaceState(
            { __overlayCount: next.length, __overlay: true },
            ''
          )
          // Push a new entry for the now-top overlay (or none if empty)
          if (next.length > 0) {
            window.history.pushState(
              { __overlayCount: next.length, __overlay: true },
              ''
            )
          }
          return next
        }

        // No overlays open — allow the browser's default back navigation
        return prev
      })
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, []) // stable — no deps needed

  // ─── Initial state guard ───────────────────────────────────────────────────
  // If someone lands on a page with an overlay already open from direct URL
  // access (e.g. /castings?new=true or /castings?id=123), ensure a history
  // entry exists so the first back press correctly closes the overlay.
  useEffect(() => {
    if (overlayCount > 0 && window.history.state?.__overlay !== true) {
      window.history.replaceState(
        { __overlayCount: overlayCount, __overlay: true },
        ''
      )
    }
  }, [overlayCount])

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
 * Usage in a component that controls an overlay (modal / drawer / sheet):
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
