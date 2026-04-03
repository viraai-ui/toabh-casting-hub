import { type ChangeEvent, useEffect, useState } from 'react'
import { Clock3, MessageCircle, Paperclip, Phone, PhoneCall, Upload } from 'lucide-react'
import { api, toApiUrl } from '@/lib/api'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import { toast } from 'sonner'
import type { Casting, CastingAttachment, Comment } from '@/types'

interface CastingCommunicationPanelProps {
  casting: Casting
}

interface CastingActivityItem {
  id: number
  casting_id: number
  action?: string
  details?: string
  description?: string
  team_member_name?: string
  user_name?: string
  timestamp?: string
  created_at?: string
}

function buildPhoneActions(phone: string, projectName: string) {
  const trimmedPhone = phone.trim()
  const digits = trimmedPhone.replace(/\D/g, '')
  if (!digits) {
    return {
      telHref: null,
      whatsappHref: null,
    }
  }

  const telHref = trimmedPhone.startsWith('+') ? `tel:+${digits}` : `tel:${digits}`

  const whatsappDigits =
    trimmedPhone.startsWith('+')
      ? digits
      : digits.length > 10
        ? digits
        : null

  return {
    telHref,
    whatsappHref: whatsappDigits
      ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(`Regarding ${projectName || 'your casting'}`)}`
      : null,
  }
}

export function CastingCommunicationPanel({ casting }: CastingCommunicationPanelProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [activities, setActivities] = useState<CastingActivityItem[]>([])
  const [attachments, setAttachments] = useState<CastingAttachment[]>([])
  const [draftNote, setDraftNote] = useState('')

  useEffect(() => {
    let active = true

    async function loadCommunication() {
      const [commentsResult, activitiesResult, attachmentsResult] = await Promise.allSettled([
        api.get(`/comments/${casting.id}`),
        api.get(`/castings/${casting.id}/activities`),
        api.get(`/castings/${casting.id}/attachments`),
      ])

      if (!active) return

      if (commentsResult.status === 'fulfilled') {
        setComments(Array.isArray(commentsResult.value) ? commentsResult.value : [])
      }

      if (activitiesResult.status === 'fulfilled') {
        setActivities(Array.isArray(activitiesResult.value) ? activitiesResult.value : [])
      }

      setAttachments(
        attachmentsResult.status === 'fulfilled'
          && attachmentsResult.value
          && typeof attachmentsResult.value === 'object'
          && Array.isArray((attachmentsResult.value as { attachments?: CastingAttachment[] }).attachments)
          ? (attachmentsResult.value as { attachments: CastingAttachment[] }).attachments
          : []
      )

      if (
        commentsResult.status === 'rejected'
        || activitiesResult.status === 'rejected'
        || attachmentsResult.status === 'rejected'
      ) {
        toast.error('Could not load the full communication history for this casting.')
      }
    }

    void loadCommunication()

    return () => {
      active = false
    }
  }, [casting.id])

  const { telHref, whatsappHref } = buildPhoneActions(casting.client_contact || '', casting.project_name)

  const handlePostNote = async () => {
    const text = draftNote.trim()
    if (!text) return

    try {
      const createdComment = await api.post('/comments', {
        casting_id: casting.id,
        text,
        user_name: 'Team',
      })

      setComments((current) => [createdComment as Comment, ...current])
      setActivities((current) => [
        {
          id: Number((createdComment as Comment).id),
          casting_id: casting.id,
          action: 'NOTE',
          details: text,
          user_name: 'Team',
          created_at: (createdComment as Comment).created_at,
        },
        ...current,
      ])
      setDraftNote('')
    } catch (error) {
      console.error('Failed to post note', error)
      toast.error('Could not post the note.')
    }
  }

  const handleAttachmentUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('user_name', 'Team')

    try {
      const uploadedAttachment = await api.upload(`/castings/${casting.id}/attachments`, formData)
      setAttachments((current) => [uploadedAttachment as CastingAttachment, ...current])
      setActivities((current) => [
        {
          id: Number((uploadedAttachment as CastingAttachment).id),
          casting_id: casting.id,
          action: 'ATTACHMENT_ADDED',
          details: `Uploaded attachment: ${(uploadedAttachment as CastingAttachment).original_filename}`,
          user_name: 'Team',
          created_at: (uploadedAttachment as CastingAttachment).created_at,
        },
        ...current,
      ])
    } catch (error) {
      console.error('Failed to upload attachment', error)
      toast.error('Could not upload the attachment.')
    }

    event.target.value = ''
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Communication</p>
          <h3 className="mt-1 text-sm font-semibold text-slate-900">Casting updates and client contact</h3>
        </div>
        <div className="flex items-center gap-2">
          {telHref && (
            <a
              href={telHref}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              Call client
            </a>
          )}
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"
            >
              <Phone className="h-3.5 w-3.5" />
              WhatsApp client
            </a>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-amber-500" />
            <h4 className="text-sm font-semibold text-slate-900">Notes</h4>
          </div>
          <p className="mt-1 text-xs text-slate-500">Thread-ready notes for the casting team.</p>

          <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <label className="sr-only" htmlFor={`casting-note-${casting.id}`}>
              Add a note for the casting team
            </label>
            <textarea
              id={`casting-note-${casting.id}`}
              value={draftNote}
              onChange={(event) => setDraftNote(event.target.value)}
              placeholder="Add a note for the casting team..."
              className="min-h-24 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
            />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => void handlePostNote()}
                className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700"
              >
                Post note
              </button>
            </div>
          </div>

          <div className="mt-3 space-y-3">
            {comments.map((comment) => (
              <article key={comment.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800">{comment.user_name}</p>
                  <p className="text-xs text-slate-400">{formatRelativeTime(comment.created_at)}</p>
                </div>
                <p className="mt-2 text-sm text-slate-600">{comment.text || comment.content}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-amber-500" />
              <h4 className="text-sm font-semibold text-slate-900">Activity</h4>
            </div>
            <p className="mt-1 text-xs text-slate-500">Recent movement on this casting.</p>

            <div className="mt-3 space-y-3">
              {activities.map((activity) => {
                const createdAt = activity.created_at || activity.timestamp || ''
                const body = activity.description || activity.details || activity.action || 'Activity update'
                const actor = activity.team_member_name || activity.user_name || 'Team'

                return (
                  <article key={activity.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-800">{actor}</p>
                      <p className="text-xs text-slate-400">{formatDate(createdAt)}</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{body}</p>
                  </article>
                )
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-amber-500" />
              <h4 className="text-sm font-semibold text-slate-900">Attachments</h4>
            </div>
            <p className="mt-1 text-xs text-slate-500">Share decks, briefs, images, and callback files.</p>

            <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm font-medium text-slate-600 transition hover:border-amber-300 hover:text-slate-900">
              <Upload className="h-4 w-4" />
              Upload attachment
              <input
                type="file"
                aria-label="Upload attachment"
                className="sr-only"
                onChange={(event) => void handleAttachmentUpload(event)}
              />
            </label>

            <div className="mt-3 space-y-2">
              {attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={toApiUrl(attachment.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition hover:border-slate-200 hover:bg-white"
                >
                  <span className="truncate font-medium">{attachment.original_filename}</span>
                  <span className="shrink-0 text-xs text-slate-400">{formatDate(attachment.created_at)}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
