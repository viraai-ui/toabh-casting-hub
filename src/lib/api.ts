const BASE = import.meta.env.VITE_API_URL || ''

export function toApiUrl(path: string) {
  if (/^https?:\/\//.test(path)) {
    return path
  }

  return `${BASE}${path}`
}

async function request(method: string, path: string, body?: object) {
  try {
    const opts: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    }
    if (body) opts.body = JSON.stringify(body)
    const r = await fetch(toApiUrl(`/api${path}`), opts)
    if (!r.ok) {
      const text = await r.text()
      console.error(`[API ${method} ${path}] HTTP ${r.status}:`, text)
      throw new Error(`HTTP ${r.status}`)
    }
    const text = await r.text()
    if (!text) return null
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  } catch (err) {
    console.error(`[API ERROR] ${method} ${path}:`, err)
    throw err
  }
}

async function upload(path: string, formData: FormData) {
  try {
    const r = await fetch(toApiUrl(`/api${path}`), {
      method: 'POST',
      body: formData,
    })
    if (!r.ok) {
      const text = await r.text()
      console.error(`[API POST ${path}] HTTP ${r.status}:`, text)
      throw new Error(`HTTP ${r.status}`)
    }
    const text = await r.text()
    if (!text) return null
    return JSON.parse(text)
  } catch (err) {
    console.error(`[API ERROR] POST ${path}:`, err)
    throw err
  }
}

export const api = {
  get: (path: string) => request('GET', path),
  post: (path: string, body: object) => request('POST', path, body),
  upload,
  put: (path: string, body: object) => request('PUT', path, body),
  del: (path: string) => request('DELETE', path),
}
