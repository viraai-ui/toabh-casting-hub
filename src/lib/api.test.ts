import { describe, expect, it, vi } from 'vitest'

describe('toApiUrl', () => {
  it('prefixes relative api paths with VITE_API_URL', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_API_URL', 'https://api.example.com')

    const { toApiUrl } = await import('./api')

    expect(toApiUrl('/api/attachments/12')).toBe('https://api.example.com/api/attachments/12')
  })

  it('leaves absolute urls untouched', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_API_URL', 'https://api.example.com')

    const { toApiUrl } = await import('./api')

    expect(toApiUrl('https://cdn.example.com/file.pdf')).toBe('https://cdn.example.com/file.pdf')
  })
})
