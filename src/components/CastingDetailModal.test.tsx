import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Casting } from '@/types'
import { CastingDetailModal } from './CastingDetailModal'

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
  },
}))

vi.mock('@/lib/api', () => ({
  api: mockApi,
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

describe('CastingDetailModal', () => {
  it('renders the communication panel for the selected casting', async () => {
    render(
      <CastingDetailModal
        open
        onClose={() => {}}
        onEdit={() => {}}
        casting={castingFixture}
      />
    )

    expect(await screen.findByRole('heading', { name: /internal comments/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /attachments/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /activity/i })).toBeInTheDocument()
  })
})
