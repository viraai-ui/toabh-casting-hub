import { X } from 'lucide-react'
import type { ClientTag } from '@/types'
import { cn } from '@/lib/utils'

function withAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`
}

export function getClientTagStyles(color: string) {
  return {
    backgroundColor: withAlpha(color, '18'),
    borderColor: withAlpha(color, '33'),
    color,
  }
}

export function ClientTagPill({
  tag,
  onRemove,
  className,
}: {
  tag: ClientTag
  onRemove?: () => void
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex select-none items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold leading-none',
        className,
      )}
      style={getClientTagStyles(tag.color)}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onTouchEnd={(event) => event.stopPropagation()}
    >
      <span className="truncate max-w-[120px]" onMouseDown={(event) => event.stopPropagation()} onTouchEnd={(event) => event.stopPropagation()}>{tag.name}</span>
      {onRemove && (
        <button
          type="button"
          className="rounded-full p-0.5 transition-opacity hover:opacity-80 cursor-pointer"
          aria-label={`Remove ${tag.name} tag`}
          onClick={(event) => {
            event.stopPropagation()
            event.preventDefault()
            onRemove()
          }}
          onMouseDown={(event) => event.stopPropagation()}
          onTouchEnd={(event) => { event.stopPropagation(); onRemove() }}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}
