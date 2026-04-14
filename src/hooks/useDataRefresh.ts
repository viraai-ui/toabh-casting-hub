import { useEffect } from 'react'

export function emitDataRefresh(scope: string = 'global') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('toabh-data-refresh', { detail: { scope, at: Date.now() } }))
}

export function useDataRefresh(onRefresh: () => void) {
  useEffect(() => {
    const handler = () => onRefresh()
    window.addEventListener('toabh-data-refresh', handler)
    return () => window.removeEventListener('toabh-data-refresh', handler)
  }, [onRefresh])
}
