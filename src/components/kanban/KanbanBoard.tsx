import { useRef, useState, useCallback, useMemo } from 'react'
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
import { ArrowLeftRight, GripHorizontal } from 'lucide-react'
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
  const [mainScrollLeft, setMainScrollLeft] = useState(0)
  const updatingRef = useRef(false)
  const mainScrollRef = useRef<HTMLDivElement>(null)
  const bottomScrollRef = useRef<HTMLDivElement>(null)
  const syncingScrollRef = useRef(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } })
  )

  const syncScroll = (source: 'main' | 'bottom') => {
    if (syncingScrollRef.current) return

    const main = mainScrollRef.current
    const bottom = bottomScrollRef.current
    if (!main || !bottom) return

    syncingScrollRef.current = true
    const scrollLeft = source === 'main' ? main.scrollLeft : bottom.scrollLeft
    main.scrollLeft = scrollLeft
    bottom.scrollLeft = scrollLeft
    setMainScrollLeft(scrollLeft)

    requestAnimationFrame(() => {
      syncingScrollRef.current = false
    })
  }

  const activeCasting = activeId
    ? castings.find((c) => String(c.id) === activeId)
    : null

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
      targetStage = over.data.current.stage
    } else if (over.data.current?.type === 'CARD') {
      const overCard = castings.find((c) => c.id === Number(over.id))
      targetStage = overCard ? resolveStage(overCard) : resolveStage(dragging)
    } else {
      targetStage = String(over.id)
    }

    const currentStage = resolveStage(dragging)
    if (targetStage === currentStage) {
      updatingRef.current = false
      return
    }

    onCastingsChange?.(
      castings.map((c) =>
        c.id === draggingId ? { ...c, pipeline_stage: targetStage, status: targetStage } : c
      )
    )

    try {
      await api.put(`/castings/${draggingId}`, { pipeline_stage: targetStage })
      toast.success(`Moved to ${targetStage}`)
    } catch (err) {
      onCastingsChange?.(castings)
      const msg = err instanceof Error ? err.message : 'Failed to update'
      toast.error(`Could not move casting: ${msg}`)
    } finally {
      updatingRef.current = false
    }
  }

  const castingsByStage: Record<string, Casting[]> = {}
  for (const stage of pipeline) {
    castingsByStage[stage.name] = []
  }

  const fallbackStage = pipeline[0]?.name ?? 'NEW'
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

  const wonColumn = {
    id: -1,
    name: 'WON',
    color: '#22c55e',
    order: 9999,
  }

  const lostColumn = {
    id: -2,
    name: 'LOST',
    color: '#ef4444',
    order: 10000,
  }

  const hasHorizontalOverflow = useMemo(
    () => pipeline.length + (wonCastings.length > 0 ? 1 : 0) + (lostCastings.length > 0 ? 1 : 0) > 1,
    [pipeline.length, wonCastings.length, lostCastings.length]
  )

  const boardContent = (
    <div className="flex min-w-max gap-3 pr-4">
      {pipeline.map((stage) => (
        <KanbanColumn
          key={stage.id}
          stage={stage}
          castings={castingsByStage[stage.name] ?? []}
          onCastingClick={onCastingClick}
        />
      ))}
      {wonCastings.length > 0 && (
        <KanbanColumn
          stage={wonColumn}
          castings={wonCastings}
          onCastingClick={onCastingClick}
        />
      )}
      {lostCastings.length > 0 && (
        <KanbanColumn
          stage={lostColumn}
          castings={lostCastings}
          onCastingClick={onCastingClick}
        />
      )}
    </div>
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-slate-50 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-slate-50 to-transparent" />

        <div
          ref={mainScrollRef}
          onScroll={() => syncScroll('main')}
          className="overflow-x-auto overflow-y-hidden scroll-smooth pb-6 [scrollbar-gutter:stable]"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {boardContent}
        </div>

        {hasHorizontalOverflow && (
          <div className="sticky bottom-20 z-20 mt-3 lg:bottom-4">
            <div className="rounded-2xl border border-slate-200 bg-white/96 px-3 py-2 shadow-lg backdrop-blur-sm">
              <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-medium text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <ArrowLeftRight className="h-3.5 w-3.5 text-slate-400" />
                  Swipe or drag horizontally
                </span>
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <GripHorizontal className="h-3.5 w-3.5" />
                  Board scroller
                </span>
              </div>
              <div
                ref={bottomScrollRef}
                onScroll={() => syncScroll('bottom')}
                className="overflow-x-auto overflow-y-hidden rounded-full bg-slate-100/90 p-1"
              >
                <div style={{ width: Math.max((mainScrollRef.current?.scrollWidth ?? 0), (mainScrollRef.current?.clientWidth ?? 0)) || '100%', height: 8 }} />
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all"
                  style={{
                    width: `${mainScrollRef.current && mainScrollRef.current.scrollWidth > 0
                      ? Math.max((mainScrollRef.current.clientWidth / mainScrollRef.current.scrollWidth) * 100, 12)
                      : 100}%`,
                    transform: `translateX(${mainScrollRef.current && mainScrollRef.current.scrollWidth > mainScrollRef.current.clientWidth
                      ? (mainScrollLeft / (mainScrollRef.current.scrollWidth - mainScrollRef.current.clientWidth)) * (100 - Math.max((mainScrollRef.current.clientWidth / mainScrollRef.current.scrollWidth) * 100, 12))
                      : 0}%)`,
                  }}
                />
              </div>
            </div>
          </div>
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
