import { type ChangeEvent, Fragment, useEffect, useMemo, useState } from 'react'
import {
  AtSign,
  Clock3,
  MessageCircle,
  Paperclip,
  Phone,
  PhoneCall,
  Reply,
  Upload,
} from 'lucide-react'
import { api, toApiUrl } from '@/lib/api'
import { formatDate, formatRelativeTime, getInitials } from '@/lib/utils'
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
  parent_id?: number | null
  mentions?: string[]
}

interface ThreadNode extends Comment {
  replies: Comment[]
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

  const normalizedDigits = trimmedPhone.startsWith('+') ? digits : digits.length === 10 ? `91${digits}` : digits

  return {
    telHref: trimmedPhone.startsWith('+') ? `tel:+${digits}` : `tel:+${normalizedDigits}`,
    whatsappHref: `https://wa.me/${normalizedDigits}?text=${encodeURIComponent(`Regarding ${projectName || 'your casting'}`)}`,
  }
}

function extractMentions(text: string) {
  return Array.from(new Set(Array.from(text.matchAll(/@([A-Za-z0-9_.-]+)/g)).map((match) => match[1])))
}

function renderMentionText(text: string) {
  const parts = text.split(/(@[A-Za-z0-9_.-]+)/g)
  return parts.map((part, index) => {
    if (/^@[A-Za-z0-9_.-]+$/.test(part)) {
      return (
        <span key={`${part}-${index}`} className="rounded-full bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700">
          {part}
        </span>
      )
    }
    return <Fragment key={`${part}-${index}`}>{part}</Fragment>
  })
}

function buildThreads(comments: Comment[]) {
  const sorted = [...comments].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const parents = new Map<number, ThreadNode>()
  const roots: ThreadNode[] = []

  sorted.forEach((comment) => {
    parents.set(comment.id, { ...comment, replies: [] })
  })

  sorted.forEach((comment) => {
    const node = parents.get(comment.id)
    if (!node) return

    if (comment.parent_id && parents.has(comment.parent_id)) {
      parents.get(comment.parent_id)?.replies.push(node)
    } else {
      roots.push(node)
    }
  })

  return roots.reverse()
}

export function CastingCommunicationPanel({ casting }: CastingCommunicationPanelProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [activities, setActivities] = useState<CastingActivityItem[]>([])
  const [attachments, setAttachments] = useState<CastingAttachment[]>([])
  const [draftNote, setDraftNote] = useState('')
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [posting, setPosting] = useState(false)
  const [uploading, setUploading] = useState(false)

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
        toast.error('Could not load the communication workspace for this casting.')
      }
    }

    void loadCommunication()

    return () => {
      active = false
    }
  }, [casting.id])

  const threadTree = useMemo(() => buildThreads(comments), [comments])
  const { telHref, whatsappHref } = buildPhoneActions(casting.client_contact || '', casting.project_name)

  const submitNote = async () => {
    const text = draftNote.trim()
    if (!text || posting) return

    setPosting(true)
    const mentions = extractMentions(text)

    try {
      const createdComment = await api.post('/comments', {
        casting_id: casting.id,
        text,
        user_name: 'Team',
        parent_id: replyTo?.id ?? null,
        mentions,
      }) as Comment

      setComments((current) => [...current, createdComment])
      setActivities((current) => [
        {
          id: Number(createdComment.id),
          casting_id: casting.id,
          action: 'NOTE',
          details: text,
          description: text,
          user_name: createdComment.user_name,
          created_at: createdComment.created_at,
          parent_id: createdComment.parent_id,
          mentions: createdComment.mentions,
        },
        ...current,
      ])
      setDraftNote('')
      setReplyTo(null)
    } catch (error) {
      console.error('Failed to post note', error)
      toast.error('Could not post the note.')
    } finally {
      setPosting(false)
    }
  }

  const handleAttachmentUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || uploading) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('user_name', 'Team')

    setUploading(true)
    try {
      const uploadedAttachment = await api.upload(`/castings/${casting.id}/attachments`, formData) as CastingAttachment
      setAttachments((current) => [uploadedAttachment, ...current])
      setActivities((current) => [
        {
          id: Number(uploadedAttachment.id),
          casting_id: casting.id,
          action: 'ATTACHMENT_ADDED',
          details: `Uploaded attachment: ${uploadedAttachment.original_filename}`,
          description: `Uploaded attachment: ${uploadedAttachment.original_filename}`,
          user_name: 'Team',
          created_at: uploadedAttachment.created_at,
        },
        ...current,
      ])
    } catch (error) {
      console.error('Failed to upload attachment', error)
      toast.error('Could not upload the attachment.')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  const renderComment = (comment: Comment, nested = false) => (
    <article
      key={comment.id}
      className={`rounded-2xl border border-slate-100 bg-slate-50 ${nested ? 'ml-5 mt-2' : ''}`}
    >
      <div className="flex items-start gap-3 px-3 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-[11px] font-semibold text-white shadow-sm">
          {getInitials(comment.user_name || 'T')}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-semibold text-slate-900">{comment.user_name || 'Team'}</p>
            <span className="text-xs text-slate-400">{formatRelativeTime(comment.created_at)}</span>
            <span className="text-xs text-slate-300">•</span>
            <span className="text-xs text-slate-400">{formatDate(comment.created_at)}</span>
          </div>
          <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
            {renderMentionText(comment.text || comment.content || '')}
          </div>
          {(comment.mentions?.length ?? 0) > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(comment.mentions || []).map((mention) => (
                <span key={`${comment.id}-${mention}`} className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                  <AtSign className="h-3 w-3" />
                  {mention}
                </span>
              ))}
            </div>
          )}
          {!nested && (
            <button
              type="button"
              onClick={() => {
                setReplyTo(comment)
                setDraftNote((current) => current || `@${(comment.user_name || 'Team').split(' ')[0]} `)
              }}
              className="mt-3 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-100"
            >
              <Reply className="h-3.5 w-3.5" />
              Reply
            </button>
          )}
        </div>
      </div>
    </article>
  )

  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        {telHref && (
          <a
            href={telHref}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
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
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
          >
            <Phone className="h-3.5 w-3.5" />
            WhatsApp client
          </a>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] xl:items-stretch">
        <div className="rounded-3xl border border-white bg-white p-4 shadow-sm sm:p-5 xl:h-full xl:min-h-[760px] xl:flex xl:flex-col">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-amber-500" />
            <h4 className="text-sm font-semibold text-slate-900">Internal Chat</h4>
          </div>

          <div className="mt-4 rounded-3xl border border-slate-100 bg-slate-50 p-3 sm:p-4">
            {replyTo && (
              <div className="mb-3 flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <div>
                  <p className="font-semibold">Replying to {replyTo.user_name}</p>
                  <p className="mt-0.5 max-w-xl truncate">{replyTo.text || replyTo.content}</p>
                </div>
                <button type="button" onClick={() => setReplyTo(null)} className="font-medium text-amber-700 hover:text-amber-900">
                  Cancel
                </button>
              </div>
            )}

            <label className="sr-only" htmlFor={`casting-note-${casting.id}`}>
              Add a note for the casting team
            </label>
            <textarea
              id={`casting-note-${casting.id}`}
              value={draftNote}
              onChange={(event) => setDraftNote(event.target.value)}
              placeholder="Add a note for the casting team. Use @Name to mention someone..."
              className="min-h-28 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
            />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => void submitNote()}
                disabled={posting || !draftNote.trim()}
                className="rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {posting ? 'Posting...' : 'Post note'}
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-3 xl:flex-1 xl:overflow-y-auto xl:pr-1">
            {threadTree.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                No internal notes yet.
              </div>
            ) : (
              threadTree.map((thread) => (
                <div key={thread.id}>
                  {renderComment(thread)}
                  {thread.replies.map((reply) => renderComment(reply, true))}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="grid gap-4 xl:h-full xl:grid-rows-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="rounded-3xl border border-white bg-white p-4 shadow-sm sm:p-5 xl:min-h-0">
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-amber-500" />
              <h4 className="text-sm font-semibold text-slate-900">Attachments</h4>
            </div>

            <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm font-medium text-slate-600 transition hover:border-amber-300 hover:text-slate-900">
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading...' : 'Upload attachment'}
              <input
                type="file"
                aria-label="Upload attachment"
                className="sr-only"
                onChange={(event) => void handleAttachmentUpload(event)}
              />
            </label>

            <div className="mt-3 space-y-2 xl:max-h-[260px] xl:overflow-y-auto xl:pr-1">
              {attachments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                  No attachments yet.
                </div>
              ) : (
                attachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    href={toApiUrl(attachment.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm text-slate-700 transition hover:border-slate-200 hover:bg-white"
                  >
                    <span className="truncate font-medium">{attachment.original_filename}</span>
                    <span className="shrink-0 text-xs text-slate-400">{formatDate(attachment.created_at)}</span>
                  </a>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white bg-white p-4 shadow-sm sm:p-5 xl:min-h-0">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-amber-500" />
              <h4 className="text-sm font-semibold text-slate-900">Activity</h4>
            </div>

            <div className="mt-3 space-y-3 xl:max-h-[420px] xl:overflow-y-auto xl:pr-1">
              {activities.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                  No activity yet.
                </div>
              ) : (
                activities.slice(0, 12).map((activity) => {
                  const createdAt = activity.created_at || activity.timestamp || ''
                  const body = activity.description || activity.details || activity.action || 'Activity update'
                  const actor = activity.team_member_name || activity.user_name || 'Team'

                  return (
                    <article key={`${activity.action}-${activity.id}-${createdAt}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-800">{actor}</p>
                        <p className="text-xs text-slate-400">{formatRelativeTime(createdAt)}</p>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{body}</p>
                    </article>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
