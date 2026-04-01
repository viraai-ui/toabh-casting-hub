import { useRef, useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  rectIntersection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { Casting, PipelineStage } from '@/types'
import { KanbanColumn } from './KanbanColumn'
import { DragOverlayCard } from './KanbanCard'

interface KanbanBoardProps {
  castings: Casting[]
  pipeline: PipelineStage[]
  onCastingClick: (c: Casting) => void
  onCastingsChange?: (castings: Casting[]) => void
}

export function KanbanBoard({
  castings,
  pipeline,
  onCastingClick,
  onCastingsChange,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  // Track ongoing update to prevent rapid drags from double-firing
  const updatingRef = useRef(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const activeCasting = activeId
    ? castings.find((c) => String(c.id) === activeId)
    : null

  // Resolve a casting's stage — always use pipeline_stage, fallback to first stage
  const resolveStage = useCallback(
    (casting: Casting): string => {
      if (casting.pipeline_stage && pipeline.some((s) => s.name === casting.pipeline_stage)) {
        return casting.pipeline_stage
      }
      if (casting.status && pipeline.some((s) => s.name === casting.status)) {
        return casting.status
      }
      return pipeline[0]?.name ?? 'NEW'
    },
    [pipeline]
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return
    if (updatingRef.current) return
    updatingRef.current = true

    const draggingId = Number(active.id)
    const dragging = castings.find((c) => c.id === draggingId)
    if (!dragging) {
      updatingRef.current = false
      return
    }

    let targetStage: string

    if (over.data.current?.type === 'COLUMN') {
      // Dropped directly on a column (empty column or column header)
      targetStage = over.data.current.stage
    } else if (over.data.current?.type === 'CARD') {
      // Dropped on another card — use that card's stage
      const overCard = castings.find((c) => c.id === Number(over.id))
      targetStage = overCard ? resolveStage(overCard) : resolveStage(dragging)
    } else {
      // Fallback: over.id might be the stage name directly
      targetStage = String(over.id)
    }

    const currentStage = resolveStage(dragging)
    if (targetStage === currentStage) {
      updatingRef.current = false
      return
    }

    // Optimistic update — immediately move card in local state
    onCastingsChange?.(
      castings.map((c) =>
        c.id === draggingId ? { ...c, pipeline_stage: targetStage, status: targetStage } : c
      )
    )

    try {
      await api.put(`/castings/${draggingId}`, { pipeline_stage: targetStage })
      toast.success(`Moved to ${targetStage}`)
    } catch (err) {
      // Rollback on failure
      onCastingsChange?.(castings)
      const msg = err instanceof Error ? err.message : 'Failed to update'
      toast.error(`Could not move casting: ${msg}`)
    } finally {
      updatingRef.current = false
    }
  }

  // Group castings by their resolved pipeline stage
  const castingsByStage: Record<string, Casting[]> = {}
  for (const stage of pipeline) {
    castingsByStage[stage.name] = []
  }
  // Castings with no matching stage go into first column (fallback)
  const fallbackStage = pipeline[0]?.name ?? 'NEW'

  // WON/LOST buckets — virtual columns not in the pipeline
  const wonCastings: Casting[] = []
  const lostCastings: Casting[] = []

  for (const casting of castings) {
    const status = casting.status?.toUpperCase()
    if (status === 'WON') {
      wonCastings.push(casting)
    } else if (status === 'LOST') {
      lostCastings.push(casting)
    } else {
      const stageName = resolveStage(casting)
      if (castingsByStage[stageName]) {
        castingsByStage[stageName].push(casting)
      } else {
        castingsByStage[fallbackStage]?.push(casting)
      }
    }
  }

  // Virtual WON column
  const wonColumn = {
    id: -1,
    name: 'WON',
    color: '#22c55e',
    order: 9999,
  }

  // Virtual LOST column
  const lostColumn = {
    id: -2,
    name: 'LOST',
    color: '#ef4444',
    order: 10000,
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {pipeline.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            castings={castingsByStage[stage.name] ?? []}
            onCastingClick={onCastingClick}
          />
        ))}
        {/* WON virtual column */}
        {wonCastings.length > 0 && (
          <KanbanColumn
            stage={wonColumn}
            castings={wonCastings}
            onCastingClick={onCastingClick}
          />
        )}
        {/* LOST virtual column */}
        {lostCastings.length > 0 && (
          <KanbanColumn
            stage={lostColumn}
            castings={lostCastings}
            onCastingClick={onCastingClick}
          />
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeCasting ? (
          <DragOverlayCard casting={activeCasting} />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
