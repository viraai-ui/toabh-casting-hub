import { type KeyboardEvent, Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { AtSign, Clock3, MessageCircle, Paperclip, Reply, SendHorizontal } from 'lucide-react'
import { api, toApiUrl } from '@/lib/api'
import { cn, formatDate, formatRelativeTime, getInitials } from '@/lib/utils'
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

interface MentionOption {
  id: number
  name: string
  role?: string
  handle: string
}

interface ActiveMention {
  start: number
  end: number
  query: string
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

function buildMentionHandle(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '')
}

function findActiveMention(text: string, caretIndex: number): ActiveMention | null {
  const beforeCaret = text.slice(0, caretIndex)
  const match = beforeCaret.match(/(^|\s)@([A-Za-z0-9_.-]*)$/)
  if (!match) return null

  const mentionText = match[0].trimStart()
  const start = caretIndex - mentionText.length
  return {
    start,
    end: caretIndex,
    query: match[2] || '',
  }
}

function renderMentionText(text: string, mentionLookup: Map<string, MentionOption>) {
  const parts = text.split(/(@[A-Za-z0-9_.-]+)/g)
  return parts.map((part, index) => {
    if (/^@[A-Za-z0-9_.-]+$/.test(part)) {
      const handle = part.slice(1).toLowerCase()
      const label = mentionLookup.get(handle)?.name || part.slice(1)
      return (
        <span key={`${part}-${index}`} className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
          @{label}
        </span>
      )
    }
    return <Fragment key={`${part}-${index}`}>{part}</Fragment>
  })
}

export function CastingCommunicationPanel({ casting }: CastingCommunicationPanelProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [activities, setActivities] = useState<CastingActivityItem[]>([])
  const [attachments, setAttachments] = useState<CastingAttachment[]>([])
  const [draftNote, setDraftNote] = useState('')
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [posting, setPosting] = useState(false)
  const [activeMention, setActiveMention] = useState<ActiveMention | null>(null)
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

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

  const mentionOptions = useMemo<MentionOption[]>(() => {
    const assigned = Array.isArray(casting.assigned_to) ? casting.assigned_to : []
    const seen = new Set<number>()
    const options: MentionOption[] = []

    assigned.forEach((member) => {
      if (!member || typeof member !== 'object') return
      const id = typeof member.id === 'number' ? member.id : Number(member.id)
      const name = typeof member.name === 'string' ? member.name.trim() : ''
      if (!id || !name || seen.has(id)) return
      seen.add(id)
      options.push({
        id,
        name,
        role: typeof member.role === 'string' ? member.role : undefined,
        handle: buildMentionHandle(name),
      })
    })

    return options
  }, [casting.assigned_to])

  const mentionLookup = useMemo(() => new Map(mentionOptions.map((member) => [member.handle, member])), [mentionOptions])

  const filteredMentionOptions = useMemo(() => {
    if (!activeMention) return []
    const query = activeMention.query.trim().toLowerCase()
    return mentionOptions
      .filter((member) => {
        if (!query) return true
        return member.name.toLowerCase().includes(query) || member.handle.includes(query)
      })
      .slice(0, 6)
  }, [activeMention, mentionOptions])

  useEffect(() => {
    setSelectedMentionIndex(0)
  }, [activeMention?.query])

  const syncMentionState = (value: string, caretIndex: number) => {
    const nextMention = findActiveMention(value, caretIndex)
    setActiveMention(nextMention && mentionOptions.length > 0 ? nextMention : null)
  }

  const insertMention = (option: MentionOption) => {
    if (!activeMention) return

    const nextValue = `${draftNote.slice(0, activeMention.start)}@${option.handle} ${draftNote.slice(activeMention.end)}`
    const nextCaret = activeMention.start + option.handle.length + 2

    setDraftNote(nextValue)
    setActiveMention(null)

    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(nextCaret, nextCaret)
    })
  }

  const submitNote = async () => {
    const text = draftNote.trim()
    if (!text || posting) return

    setPosting(true)
    const mentions = Array.from(new Set(
      Array.from(text.matchAll(/@([A-Za-z0-9_.-]+)/g))
        .map((match) => match[1].toLowerCase())
        .filter((handle) => mentionLookup.has(handle))
    ))

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
      setActiveMention(null)
    } catch (error) {
      console.error('Failed to post note', error)
      toast.error('Could not post the note.')
    } finally {
      setPosting(false)
    }
  }

  const handleTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (activeMention && filteredMentionOptions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedMentionIndex((current) => (current + 1) % filteredMentionOptions.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedMentionIndex((current) => (current - 1 + filteredMentionOptions.length) % filteredMentionOptions.length)
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        insertMention(filteredMentionOptions[selectedMentionIndex])
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setActiveMention(null)
        return
      }
    }

    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      void submitNote()
    }
  }

  const renderComment = (comment: Comment, nested = false) => (
    <article
      key={comment.id}
      className={cn(
        'rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm',
        nested && 'ml-5 mt-2 border-slate-100 bg-slate-50/80'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-[10px] font-semibold text-white shadow-sm">
          {getInitials(comment.user_name || 'T')}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-semibold text-slate-900">{comment.user_name || 'Team'}</p>
            <span className="text-xs text-slate-400">{formatRelativeTime(comment.created_at)}</span>
            <span className="text-xs text-slate-300">•</span>
            <span className="text-xs text-slate-400">{formatDate(comment.created_at)}</span>
          </div>
          <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
            {renderMentionText(comment.text || comment.content || '', mentionLookup)}
          </div>
          {(comment.mentions?.length ?? 0) > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(comment.mentions || []).map((mention) => {
                const label = mentionLookup.get(mention.toLowerCase())?.name || mention
                return (
                  <span key={`${comment.id}-${mention}`} className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                    <AtSign className="h-3 w-3" />
                    {label}
                  </span>
                )
              })}
            </div>
          )}
          {!nested && (
            <button
              type="button"
              onClick={() => {
                setReplyTo(comment)
                setDraftNote((current) => current || '')
                textareaRef.current?.focus()
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
      <div className="mb-4 rounded-[24px] border border-amber-200 bg-amber-50/70 px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">Communication workspace</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">Keep team discussion, files, and activity in one decision trail.</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">Use comments for internal coordination, mentions for handoffs, and attachments/activity as the working history for this casting.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
            <span className="rounded-full bg-white px-2.5 py-1">{threadTree.length} threads</span>
            <span className="rounded-full bg-white px-2.5 py-1">{attachments.length} files</span>
            <span className="rounded-full bg-white px-2.5 py-1">{activities.length} updates</span>
          </div>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)] xl:items-start">
        <div className="rounded-3xl border border-white bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-amber-500" />
              <h4 className="text-sm font-semibold text-slate-900">Internal Comments</h4>
            </div>
            <span className="text-xs text-slate-400">Team-only discussion</span>
          </div>

          <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
            {replyTo && (
              <div className="mb-3 flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <div className="min-w-0">
                  <p className="font-semibold">Replying to {replyTo.user_name}</p>
                  <p className="mt-0.5 truncate">{replyTo.text || replyTo.content}</p>
                </div>
                <button type="button" onClick={() => setReplyTo(null)} className="font-medium text-amber-700 hover:text-amber-900">
                  Cancel
                </button>
              </div>
            )}

            <div className="relative">
              <label className="sr-only" htmlFor={`casting-note-${casting.id}`}>
                Add a comment for the project team
              </label>
              <textarea
                ref={textareaRef}
                id={`casting-note-${casting.id}`}
                value={draftNote}
                onChange={(event) => {
                  const value = event.target.value
                  setDraftNote(value)
                  syncMentionState(value, event.target.selectionStart ?? value.length)
                }}
                onClick={(event) => syncMentionState(draftNote, event.currentTarget.selectionStart ?? draftNote.length)}
                onKeyUp={(event) => syncMentionState(event.currentTarget.value, event.currentTarget.selectionStart ?? event.currentTarget.value.length)}
                onKeyDown={handleTextareaKeyDown}
                placeholder={mentionOptions.length ? 'Write a comment… Type @ to mention project team members' : 'Write a comment…'}
                className="min-h-[88px] w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
              />

              {activeMention && filteredMentionOptions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-10 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                  {filteredMentionOptions.map((option, index) => (
                    <button
                      key={option.id}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault()
                        insertMention(option)
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2.5 text-left transition',
                        index === selectedMentionIndex ? 'bg-amber-50' : 'hover:bg-slate-50'
                      )}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
                        {getInitials(option.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{option.name}</p>
                        <p className="truncate text-xs text-slate-400">{option.role || 'Project team'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-slate-400">Only assigned project team members can be tagged.</p>
                <p className="mt-1 text-[11px] text-slate-400">Tip: press Ctrl+Enter to post quickly.</p>
              </div>
              <button
                type="button"
                onClick={() => void submitNote()}
                disabled={posting || !draftNote.trim()}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <SendHorizontal className="h-3.5 w-3.5" />
                {posting ? 'Posting...' : 'Post comment'}
              </button>
            </div>
          </div>

          <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {threadTree.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Comments</p>
                <p className="mt-3 text-sm font-semibold text-slate-900">No internal comments yet</p>
                <p className="mt-2 text-sm text-slate-500">Use this thread to capture client notes, approvals, and internal handoffs on the job.</p>
                <p className="mt-2 text-xs text-slate-400">Once the job is active, this becomes the decision trail for the team behind the submission flow.</p>
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

        <div className="space-y-4">
          <div className="rounded-3xl border border-white bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-amber-500" />
              <h4 className="text-sm font-semibold text-slate-900">Attachments</h4>
            </div>
            <p className="mt-1 text-xs text-slate-400">View existing files here. Uploads are available only in edit mode.</p>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-500">
              Keep the latest client briefs, decks, references, and internal working files here so review and follow-up stay in one place.
            </div>

            <div className="mt-3 max-h-[220px] space-y-2 overflow-y-auto pr-1">
              {attachments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Files</p>
                  <p className="mt-3 text-sm font-semibold text-slate-900">No attachments yet</p>
                  <p className="mt-2 text-sm text-slate-500">Decks, briefs, and reference files added to this job will show up here.</p>
                  <p className="mt-2 text-xs text-slate-400">Keep the latest client-facing material and internal reference files together in this workspace.</p>
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

          <div className="rounded-3xl border border-white bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-amber-500" />
              <h4 className="text-sm font-semibold text-slate-900">Activity</h4>
            </div>
            <p className="mt-1 text-xs text-slate-400">Recent status movement, uploads, and team actions on this casting.</p>

            <div className="mt-3 max-h-[280px] space-y-2.5 overflow-y-auto pr-1">
              {activities.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Timeline</p>
                  <p className="mt-3 text-sm font-semibold text-slate-900">No activity yet</p>
                  <p className="mt-2 text-sm text-slate-500">Status changes, uploads, and team actions on this job will appear here.</p>
                  <p className="mt-2 text-xs text-slate-400">This becomes the audit trail for how the casting actually moved forward.</p>
                </div>
              ) : (
                activities.slice(0, 12).map((activity) => {
                  const createdAt = activity.created_at || activity.timestamp || ''
                  const body = activity.description || activity.details || activity.action || 'Activity update'
                  const actor = activity.team_member_name || activity.user_name || 'Team'

                  return (
                    <article key={`${activity.action}-${activity.id}-${createdAt}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-slate-800">{actor}</p>
                        <p className="shrink-0 text-xs text-slate-400">{formatRelativeTime(createdAt)}</p>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
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
