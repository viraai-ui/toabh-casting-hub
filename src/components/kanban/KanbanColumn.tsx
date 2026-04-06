import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import type { Casting, PipelineStage } from '@/types'
import { cn } from '@/lib/utils'
import { SortableCard } from './KanbanCard'

interface KanbanColumnProps {
  stage: PipelineStage
  castings: Casting[]
  onCastingClick: (c: Casting) => void
}

export function KanbanColumn({ stage, castings, onCastingClick }: KanbanColumnProps) {
  const cardIds = castings.map((c) => String(c.id))

  const { setNodeRef, isOver } = useDroppable({
    id: `column-${stage.id}`,
    data: { type: 'COLUMN', stage: stage.name },
  })

  return (
    <div className="flex-shrink-0 w-72 flex flex-col">
      {/* Column Header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: stage.color }}
        />
        <h3 className="font-semibold text-slate-900 text-sm">{stage.name}</h3>
        <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full ml-auto">
          {castings.length}
        </span>
      </div>

      {/* Droppable area for this stage */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-col gap-2 min-h-[200px] p-3 rounded-2xl border transition-all duration-150',
          isOver
            ? 'border-amber-400 bg-amber-50/40 shadow-lg ring-2 ring-amber-300/50'
            : 'bg-white/40 backdrop-blur-sm border-white/20'
        )}
      >
        <SortableContext
          items={cardIds}
          strategy={verticalListSortingStrategy}
        >
          {castings.length > 0 ? (
            castings.map((casting) => (
              <SortableCard
                key={casting.id}
                casting={casting}
                onClick={() => onCastingClick(casting)}
              />
            ))
          ) : (
            <EmptyColumnState />
          )}
        </SortableContext>
      </div>
    </div>
  )
}

function EmptyColumnState() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-[120px] border-2 border-dashed border-slate-200 rounded-lg text-slate-400">
      <p className="text-xs">No jobs</p>
    </div>
  )
}
