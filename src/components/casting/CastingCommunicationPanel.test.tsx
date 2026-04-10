import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Casting } from '@/types'
import { CastingCommunicationPanel } from './CastingCommunicationPanel'

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    upload: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
  },
}))

vi.mock('@/lib/api', () => ({
  api: mockApi,
  toApiUrl: (path: string) => path,
}))

const castingFixture: Casting = {
  id: 42,
  project_name: 'Monsoon Campaign',
  client_name: 'Aisha Kapoor',
  client_company: 'Southlight Studios',
  client_contact: '+91 98765 43210',
  client_email: 'aisha@southlight.test',
  pipeline_stage: 'IN_PROGRESS',
  status: 'IN_PROGRESS',
  source: 'Referral',
  shoot_date_start: '2026-04-02T09:00:00.000Z',
  shoot_date_end: '2026-04-03T18:00:00.000Z',
  location: 'Mumbai',
  medium: 'Digital',
  project_type: 'Commercial',
  requirements: 'Need quick client turnaround',
  priority: 'High',
  budget_min: 50000,
  budget_max: 100000,
  assigned_to: [],
  assigned_ids: [],
  assigned_names: null,
  custom_fields: '{}',
  created_at: '2026-04-01T09:00:00.000Z',
  updated_at: '2026-04-02T09:00:00.000Z',
}

describe('CastingCommunicationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads notes, activity, and attachments for a casting', async () => {
    mockApi.get
      .mockResolvedValueOnce([
        {
          id: 7,
          casting_id: 42,
          text: '@Rhea client approved the revised callback list.',
          user_name: 'Neha Rao',
          created_at: '2026-04-02T08:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 9,
          casting_id: 42,
          action: 'STATUS_CHANGED',
          details: 'Moved from Review to In Progress',
          team_member_name: 'Aarav Shah',
          timestamp: '2026-04-02T07:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce({
        attachments: [
          {
            id: 3,
            casting_id: 42,
            original_filename: 'callback-brief.pdf',
            mime_type: 'application/pdf',
            file_size: 234567,
            created_at: '2026-04-02T06:00:00.000Z',
            url: '/api/attachments/3',
          },
        ],
      })

    render(<CastingCommunicationPanel casting={castingFixture} />)

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenNthCalledWith(1, '/comments/42')
      expect(mockApi.get).toHaveBeenNthCalledWith(2, '/castings/42/activities')
      expect(mockApi.get).toHaveBeenNthCalledWith(3, '/castings/42/attachments')
    })

    expect(await screen.findByText(/client approved the revised callback list/i)).toBeInTheDocument()
    expect(screen.getByText(/moved from review to in progress/i)).toBeInTheDocument()

    expect(screen.getByText(/internal comments/i)).toBeInTheDocument()
    expect(screen.getByText(/team-only discussion/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /callback-brief\.pdf/i })).toHaveAttribute('href', '/api/attachments/3')
  })

  it('posts a new note and adds it to the top of the thread', async () => {
    mockApi.get
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ attachments: [] })
    mockApi.post.mockResolvedValueOnce({
      id: 11,
      casting_id: 42,
      text: '@Rhea call sheet shared with the client.',
      user_name: 'Team',
      created_at: '2026-04-02T10:00:00.000Z',
    })

    render(<CastingCommunicationPanel casting={castingFixture} />)

    fireEvent.change(await screen.findByLabelText(/add a comment for the project team/i), {
      target: { value: '@Rhea call sheet shared with the client.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /post comment/i }))

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/comments', {
        casting_id: 42,
        text: '@Rhea call sheet shared with the client.',
        user_name: 'Team',
        mentions: [],
        parent_id: null,
      })
    })

    await waitFor(() => {
      expect(screen.getAllByText(/call sheet shared with the client/i)).toHaveLength(2)
    })
  })

  it('shows the empty attachment state when no files are present', async () => {
    mockApi.get
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ attachments: [] })

    render(<CastingCommunicationPanel casting={castingFixture} />)

    expect(await screen.findByText(/no attachments yet/i)).toBeInTheDocument()
  })
})
