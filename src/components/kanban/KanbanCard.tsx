import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Phone, MessageCircle, Calendar, Users } from 'lucide-react'
import { cn, getInitials, formatDate, formatCurrency } from '@/lib/utils'
import type { Casting } from '@/types'

/* ─────────────────────────────────────────────────────────────────────────────
   Shared card body — used by both SortableCard and DragOverlayCard so they
   render identically (same structure = same height = smooth drag).
   ───────────────────────────────────────────────────────────────────────────── */
function KanbanCardBody({
  casting,
  dragOverlay = false,
}: {
  casting: Casting
  dragOverlay?: boolean
}) {
  const initials = getInitials(casting.client_name)

  // Strip WhatsApp chars for wa.me link
  const waNumber = casting.client_contact?.replace(/\D/g, '') ?? ''

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-xl bg-white border border-slate-200',
        'transition-all duration-150',
        // Drag states handled by parent; this gives the resting state a premium feel
        !dragOverlay && 'shadow-sm hover:shadow-md hover:border-slate-300',
      )}
      style={{ minHeight: 0 }}
    >
      {/* ── ZONE 1: Initials + Project title + Action icons ─────────────── */}
      <div className="relative flex items-start gap-2.5 px-3 pt-3 pb-2 min-w-0">
        {/* Client initials avatar — consistent visual anchor */}
        <div
          className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5"
          title={casting.client_name}
        >
          {initials}
        </div>

        {/* Project name — bold, truncate, occupies remaining width */}
        <p
          className="flex-1 min-w-0 font-semibold text-[13px] text-slate-900 leading-snug line-clamp-2"
          title={casting.project_name || 'Untitled'}
        >
          {casting.project_name || 'Untitled'}
        </p>

        {/* Action icons — absolute top-right, outside flex flow so they don't shrink title */}
        {casting.client_contact && (
          <div className="absolute right-2 top-2 flex items-center gap-0.5 z-10">
            <a
              href={'tel:' + casting.client_contact}
              onClick={(e) => e.stopPropagation()}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              title="Call"
            >
              <Phone className="w-3.5 h-3.5" />
            </a>
            <a
              href={'https://wa.me/' + waNumber}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-green-50 text-slate-400 hover:text-green-600 transition-colors"
              title="WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>

      {/* ── ZONE 2: Info stack — uniform vertical rhythm ────────────────── */}
      <div className="flex-1 px-3 space-y-0.5 min-w-0">
        {/* Client name */}
        <InfoLine
          value={casting.client_name}
          colorClass="text-slate-700"
          fontWeight="font-medium"
          icon={null}
        />

        {/* Phone */}
        <InfoLine
          value={casting.client_contact}
          colorClass="text-slate-500"
          icon={<Phone className="w-3 h-3 text-slate-400 shrink-0" />}
        />

        {/* Email */}
        <InfoLine
          value={casting.client_email}
          colorClass="text-slate-400"
          icon={null}
        />

        {/* Shoot dates */}
        {casting.shoot_date_start && (
          <div className="flex items-center gap-1.5 min-w-0">
            <Calendar className="w-3 h-3 text-slate-300 shrink-0 flex-shrink-0" />
            <span
              className="text-[11px] text-slate-400 truncate"
              title={
                casting.shoot_date_end && casting.shoot_date_end !== casting.shoot_date_start
                  ? `${formatDate(casting.shoot_date_start)} – ${formatDate(casting.shoot_date_end)}`
                  : formatDate(casting.shoot_date_start)
              }
            >
              {formatDate(casting.shoot_date_start)}
              {casting.shoot_date_end && casting.shoot_date_end !== casting.shoot_date_start
                ? ` – ${formatDate(casting.shoot_date_end)}`
                : ''}
            </span>
          </div>
        )}

        {/* Budget */}
        {(casting.budget_min || casting.budget_max) && (
          <InfoLine
            value={
              casting.budget_min && casting.budget_max
                ? `${formatCurrency(casting.budget_min)} – ${formatCurrency(casting.budget_max)}`
                : formatCurrency(casting.budget_max ?? casting.budget_min!)
            }
            colorClass="text-slate-600"
            fontWeight="font-medium"
            icon={null}
          />
        )}
      </div>

      {/* ── ZONE 3: Assigned team member(s) — bottom strip ─────────────── */}
      {casting.assigned_names ? (
        <div className="flex items-center gap-1.5 px-3 pb-2.5 pt-2 mt-auto border-t border-slate-100 min-w-0">
          <Users className="w-3 h-3 text-slate-300 shrink-0 flex-shrink-0" />
          <span
            className="text-[11px] text-slate-400 truncate"
            title={casting.assigned_names}
          >
            {casting.assigned_names}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 px-3 pb-2.5 pt-2 mt-auto border-t border-slate-100 min-w-0">
          <Users className="w-3 h-3 text-slate-200 shrink-0 flex-shrink-0" />
          <span className="text-[11px] text-slate-300">Unassigned</span>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Helper: single info row with icon + truncated text
   ───────────────────────────────────────────────────────────────────────────── */
function InfoLine({
  value,
  colorClass = 'text-slate-500',
  fontWeight = 'font-normal',
  icon,
}: {
  value?: string | null
  colorClass?: string
  fontWeight?: string
  icon?: React.ReactNode | null
}) {
  if (!value) return null
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      {icon && <span className="shrink-0 flex-shrink-0">{icon}</span>}
      <span
        className={cn('text-[11px] truncate', colorClass, fontWeight)}
        title={value}
      >
        {value}
      </span>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   SortableCard — draggable kanban card
   ───────────────────────────────────────────────────────────────────────────── */
interface SortableCardProps {
  casting: Casting
  onClick: () => void
}

export function SortableCard({ casting, onClick }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: String(casting.id),
    data: { type: 'CARD', casting },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-40 z-50'
      )}
    >
      <KanbanCardBody casting={casting} />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   DragOverlayCard — floating card while dragging (no dnd-kit listeners)
   ───────────────────────────────────────────────────────────────────────────── */
export function DragOverlayCard({ casting }: { casting: Casting }) {
  return (
    <div className="cursor-grabbing">
      <KanbanCardBody casting={casting} dragOverlay />
    </div>
  )
}
