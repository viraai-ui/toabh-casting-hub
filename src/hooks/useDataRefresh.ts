import { useEffect } from 'react'

const REFRESH_EVENT = 'toabh-data-refresh'
const REFRESH_KEY = 'toabh-data-refresh-signal'

function createChannel() {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null
  return new BroadcastChannel(REFRESH_EVENT)
}

export function emitDataRefresh(scope: string = 'global') {
  if (typeof window === 'undefined') return
  const payload = { scope, at: Date.now() }
  window.dispatchEvent(new CustomEvent(REFRESH_EVENT, { detail: payload }))
  try {
    localStorage.setItem(REFRESH_KEY, JSON.stringify(payload))
  } catch {
    // ignore storage write failures
  }
  const channel = createChannel()
  channel?.postMessage(payload)
  channel?.close()
}

export function useDataRefresh(onRefresh: () => void) {
  useEffect(() => {
    const handleRefresh = () => onRefresh()
    const handleStorage = (event: StorageEvent) => {
      if (event.key === REFRESH_KEY && event.newValue) onRefresh()
    }

    const channel = createChannel()
    channel?.addEventListener('message', handleRefresh)
    window.addEventListener(REFRESH_EVENT, handleRefresh)
    window.addEventListener('storage', handleStorage)

    return () => {
      channel?.removeEventListener('message', handleRefresh)
      channel?.close()
      window.removeEventListener(REFRESH_EVENT, handleRefresh)
      window.removeEventListener('storage', handleStorage)
    }
  }, [onRefresh])
}
