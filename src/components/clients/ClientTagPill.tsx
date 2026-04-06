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
        'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold leading-none',
        className,
      )}
      style={getClientTagStyles(tag.color)}
      onClick={(event) => event.stopPropagation()}
    >
      <span className="truncate max-w-[120px]">{tag.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onRemove()
          }}
          className="rounded-full p-0.5 transition-opacity hover:opacity-80"
          aria-label={`Remove ${tag.name} tag`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}
