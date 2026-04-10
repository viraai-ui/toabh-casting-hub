import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { OverlayProvider } from '@/hooks/useOverlayManager'
import { CastingAssistant } from './CastingAssistant'

const { queryAssistantMock } = vi.hoisted(() => ({
  queryAssistantMock: vi.fn(),
}))

vi.mock('@/lib/assistant', async () => {
  const actual = await vi.importActual<typeof import('@/lib/assistant')>('@/lib/assistant')
  return {
    ...actual,
    queryAssistant: queryAssistantMock,
  }
})

describe('CastingAssistant', () => {
  beforeEach(() => {
    queryAssistantMock.mockReset()
  })

  it('opens the floating panel and shows the assistant shell', () => {
    render(
      <OverlayProvider>
        <CastingAssistant />
      </OverlayProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /open assistant/i }))

    expect(screen.getByText(/casting concierge/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start voice input/i })).toBeInTheDocument()
    expect(screen.getByText(/ask about today's queue, delays, weekly work/i)).toBeInTheDocument()
  })

  it('submits a query and renders assistant cards from the response', async () => {
    queryAssistantMock.mockResolvedValue({
      intent: 'delayed_castings',
      answer: 'I found 1 delayed casting.',
      cards: [
        {
          kind: 'casting',
          title: 'Nike Summer',
          subtitle: 'Nike · IN_PROGRESS',
          meta: ['Assigned: Ava'],
          chips: ['2d late'],
        },
      ],
      suggestions: ['Show delayed castings'],
      totals: { count: 1 },
      context: {},
      generated_at: new Date().toISOString(),
    })

    render(
      <OverlayProvider>
        <CastingAssistant />
      </OverlayProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /open assistant/i }))
    fireEvent.change(screen.getByLabelText(/ask the assistant/i), {
      target: { value: 'Show delayed castings' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send assistant query/i }))

    await waitFor(() => expect(queryAssistantMock).toHaveBeenCalledWith('Show delayed castings'))
    expect(await screen.findByText('I found 1 delayed casting.')).toBeInTheDocument()
    expect(screen.getByText('Nike Summer')).toBeInTheDocument()
    expect(screen.getByText('2d late')).toBeInTheDocument()
  })
})
