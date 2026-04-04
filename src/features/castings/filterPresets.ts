import type { Casting, TeamMember } from '@/types'

export type CastingFilters = Record<string, string[]>

export interface SavedCastingPreset {
  id: string
  name: string
  filters: CastingFilters
}

export const CASTING_PRESET_STORAGE_KEY = 'casting_filter_presets_v2'

const FILTER_KEYS = ['status', 'source', 'team_member', 'date_from', 'date_to'] as const

export function normalizeCastingFilters(filters: CastingFilters): CastingFilters {
  return Object.entries(filters).reduce<CastingFilters>((acc, [key, values]) => {
    if (!FILTER_KEYS.includes(key as (typeof FILTER_KEYS)[number])) {
      return acc
    }

    const normalizedValues = Array.isArray(values)
      ? [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])]
      : []

    if (normalizedValues.length > 0) {
      acc[key] = normalizedValues
    }

    return acc
  }, {})
}

export function countActiveCastingFilters(filters: CastingFilters): number {
  return Object.values(normalizeCastingFilters(filters)).reduce((count, values) => count + values.length, 0)
}

export function areCastingFiltersEqual(a: CastingFilters, b: CastingFilters): boolean {
  const normalizedA = normalizeCastingFilters(a)
  const normalizedB = normalizeCastingFilters(b)
  return JSON.stringify(normalizedA) === JSON.stringify(normalizedB)
}

export function sanitizePresetName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export function upsertCastingPreset(
  presets: SavedCastingPreset[],
  preset: Omit<SavedCastingPreset, 'id'> & { id?: string }
): SavedCastingPreset[] {
  const name = sanitizePresetName(preset.name)
  const filters = normalizeCastingFilters(preset.filters)
  const existing = presets.find((item) => item.name.toLowerCase() === name.toLowerCase())
  const nextPreset: SavedCastingPreset = {
    id: existing?.id ?? preset.id ?? `preset-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
    filters,
  }

  return [...presets.filter((item) => item.id !== nextPreset.id), nextPreset].sort((left, right) =>
    left.name.localeCompare(right.name)
  )
}

export function parseStoredCastingPresets(raw: string | null): SavedCastingPreset[] {
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        const name = sanitizePresetName(String(item.name ?? ''))
        if (!name) return null

        return {
          id: String(item.id ?? `preset-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`),
          name,
          filters: normalizeCastingFilters((item.filters ?? {}) as CastingFilters),
        } satisfies SavedCastingPreset
      })
      .filter((item): item is SavedCastingPreset => Boolean(item))
      .sort((left, right) => left.name.localeCompare(right.name))
  } catch {
    return []
  }
}

export function getMyCastingsFilters(team: TeamMember[], currentUserName?: string | null): CastingFilters | null {
  const normalizedName = sanitizePresetName(currentUserName || '')
  if (!normalizedName) return null

  const matchedMember = team.find(
    (member) => sanitizePresetName(member.name).toLowerCase() === normalizedName.toLowerCase()
  )

  return matchedMember ? { team_member: [String(matchedMember.id)] } : null
}

export function matchesCastingFilters(casting: Casting, filters: CastingFilters): boolean {
  const normalizedFilters = normalizeCastingFilters(filters)

  if (normalizedFilters.status?.length && !normalizedFilters.status.includes(casting.status)) {
    return false
  }

  if (normalizedFilters.source?.length && !normalizedFilters.source.includes(casting.source)) {
    return false
  }

  if (normalizedFilters.team_member?.length) {
    const assignedIds = parseAssignedIds(casting.assigned_ids)
    const hasMatchingMember = normalizedFilters.team_member.some((memberId) => assignedIds.includes(memberId))
    if (!hasMatchingMember) {
      return false
    }
  }

  const castingDate = getComparableDate(casting.shoot_date_start || casting.created_at)
  if (normalizedFilters.date_from?.[0]) {
    const fromDate = getComparableDate(normalizedFilters.date_from[0])
    if (!castingDate || !fromDate || castingDate < fromDate) {
      return false
    }
  }

  if (normalizedFilters.date_to?.[0]) {
    const toDate = getComparableDate(normalizedFilters.date_to[0])
    if (!castingDate || !toDate || castingDate > toDate) {
      return false
    }
  }

  return true
}

function parseAssignedIds(value: Casting['assigned_ids'] | null | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }

  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function getComparableDate(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}
