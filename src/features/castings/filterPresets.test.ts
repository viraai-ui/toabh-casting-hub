import { describe, expect, it } from 'vitest'
import type { Casting, TeamMember } from '@/types'
import {
  areCastingFiltersEqual,
  getMyCastingsFilters,
  matchesCastingFilters,
  normalizeCastingFilters,
  parseStoredCastingPresets,
  upsertCastingPreset,
} from './filterPresets'

const castingFixture: Casting = {
  id: 7,
  project_name: 'Luxury Edit',
  client_name: 'Aisha Kapoor',
  client_company: 'Southlight',
  client_contact: '+91 98765 43210',
  client_email: 'aisha@example.com',
  pipeline_stage: 'IN_PROGRESS',
  status: 'IN_PROGRESS',
  source: 'Referral',
  shoot_date_start: '2026-04-14T09:00:00.000Z',
  shoot_date_end: '2026-04-15T17:00:00.000Z',
  location: 'Mumbai',
  medium: 'Digital',
  project_type: 'Campaign',
  requirements: 'Need fast turnaround',
  priority: 'High',
  budget_min: 10000,
  budget_max: 50000,
  assigned_to: ['Toaney Bhatia'],
  assigned_ids: '2, 5',
  assigned_names: 'Toaney Bhatia',
  custom_fields: '{}',
  created_at: '2026-04-01T09:00:00.000Z',
  updated_at: '2026-04-01T09:00:00.000Z',
}

const teamFixture: TeamMember[] = [
  { id: 2, name: 'Toaney Bhatia', role: 'Founder', is_active: true },
  { id: 5, name: 'Aryan Dhawan', role: 'Team Member', is_active: true },
]

describe('filterPresets helpers', () => {
  it('normalizes filters by trimming values and removing empty keys', () => {
    expect(
      normalizeCastingFilters({
        status: [' IN_PROGRESS ', 'IN_PROGRESS'],
        source: [''],
        ignored_key: ['value'],
      })
    ).toEqual({ status: ['IN_PROGRESS'] })
  })

  it('matches castings against team member and date filters', () => {
    expect(
      matchesCastingFilters(castingFixture, {
        team_member: ['5'],
        date_from: ['2026-04-10'],
        date_to: ['2026-04-20'],
      })
    ).toBe(true)

    expect(
      matchesCastingFilters(castingFixture, {
        date_from: ['2026-04-20'],
      })
    ).toBe(false)
  })

  it('resolves the My Castings preset from the current user name', () => {
    expect(getMyCastingsFilters(teamFixture, 'toaney bhatia')).toEqual({ team_member: ['2'] })
    expect(getMyCastingsFilters(teamFixture, 'Unknown User')).toBeNull()
  })

  it('upserts presets by name and parses stored presets safely', () => {
    const presets = upsertCastingPreset([], {
      name: '  Referral Focus  ',
      filters: { source: ['Referral'] },
    })

    const updated = upsertCastingPreset(presets, {
      name: 'referral focus',
      filters: { status: ['IN_PROGRESS'] },
    })

    expect(updated).toHaveLength(1)
    expect(updated[0].filters).toEqual({ status: ['IN_PROGRESS'] })
    expect(
      parseStoredCastingPresets(
        JSON.stringify([{ id: 'preset-one', name: 'Preset One', filters: { source: ['Email'] } }, null])
      )
    ).toEqual([{ id: 'preset-one', name: 'Preset One', filters: { source: ['Email'] } }])
  })

  it('compares filters consistently regardless of normalization noise', () => {
    expect(
      areCastingFiltersEqual(
        { status: [' IN_PROGRESS '], source: [] },
        { status: ['IN_PROGRESS'] }
      )
    ).toBe(true)
  })
})
