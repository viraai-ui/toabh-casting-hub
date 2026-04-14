import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Calendar, Loader2, MessageSquare, Plus, X } from 'lucide-react'
import { api } from '@/lib/api'
import { cn, formatDate, formatRelativeTime, getInitials } from '@/lib/utils'
import { useAppStore } from '@/hooks/useStore'
import type { Comment, Task, TaskStage, TeamMember } from '@/types'

function buildMentionHandle(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '')
}

function findActiveMention(text: string, caretIndex: number) {
  const beforeCaret = text.slice(0, caretIndex)
  const match = beforeCaret.match(/(^|\s)@([A-Za-z0-9_.-]*)$/)
  if (!match) return null
  const mentionText = match[0].trimStart()
  return { start: caretIndex - mentionText.length, end: caretIndex, query: match[2] || '' }
}

function renderMentionText(text: string, mentionLookup: Map<string, string>) {
  return text.split(/(@[A-Za-z0-9_.-]+)/g).map((part, index) => {
    if (/^@[A-Za-z0-9_.-]+$/.test(part)) {
      const handle = part.slice(1).toLowerCase()
      return <span key={`${part}-${index}`} className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">@{mentionLookup.get(handle) || part.slice(1)}</span>
    }
    return <Fragment key={`${part}-${index}`}>{part}</Fragment>
  })
}

function TaskComposer({
  open,
  onClose,
  onSaved,
  team,
  stages,
  task,
  currentUserTeamMemberId,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  team: TeamMember[]
  stages: TaskStage[]
  task: Task | null
  currentUserTeamMemberId?: number | null
}) {
  const [form, setForm] = useState({ title: '', description: '', status: 'Not Started', due_date: '', assignee_ids: [] as number[] })
  const [saving, setSaving] = useState(false)

  const handleComposerClose = () => {
    if (saving) return
    onClose()
  }

  useEffect(() => {
    if (!open) return
    setForm({
      title: task?.title || '',
      description: task?.description || '',
      status: task?.status || stages[0]?.name || 'Not Started',
      due_date: task?.due_date || '',
      assignee_ids: task?.assigned_to?.map((member) => member.id) || (currentUserTeamMemberId ? [currentUserTeamMemberId] : []),
    })
  }, [open, task, stages, currentUserTeamMemberId])

  if (!open) return null

  const save = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      if (task) {
        await api.put(`/tasks/${task.id}`, form)
      } else {
        await api.post('/tasks', form)
      }
      onSaved()
      handleComposerClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 p-4" onClick={handleComposerClose}>
      <div className="w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{task ? 'Edit Task' : 'New Task'}</h3>
          <button onClick={handleComposerClose} disabled={saving} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 space-y-4">
          <input value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} placeholder="Task title" className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100" />
          <textarea value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} rows={3} placeholder="Description" className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100" />
          <div className="grid gap-4 sm:grid-cols-2">
            <select value={form.status} onChange={(e) => setForm((c) => ({ ...c, status: e.target.value }))} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100">
              {stages.map((stage) => <option key={stage.id} value={stage.name}>{stage.name}</option>)}
            </select>
            <input type="date" value={form.due_date} onChange={(e) => setForm((c) => ({ ...c, due_date: e.target.value }))} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100" />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Assignee</p>
            <div className="flex flex-wrap gap-2">
              {team.map((member) => {
                const selected = form.assignee_ids.includes(member.id)
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setForm((c) => ({ ...c, assignee_ids: selected ? c.assignee_ids.filter((id) => id !== member.id) : [...c.assignee_ids, member.id] }))}
                    className={cn('rounded-full border px-3 py-1.5 text-sm transition', selected ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600')}
                  >
                    {member.name}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={handleComposerClose} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-50">Cancel</button>
          <button onClick={save} disabled={saving} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">{saving ? 'Saving...' : 'Save Task'}</button>
        </div>
      </div>
    </div>
  )
}

function TaskDetail({
  task,
  team,
  stages,
  onClose,
  onRefresh,
}: {
  task: Task | null
  team: TeamMember[]
  stages: TaskStage[]
  onClose: () => void
  onRefresh: () => void
}) {
  const { currentUser } = useAppStore()
  const [comments, setComments] = useState<Comment[]>([])
  const [activities, setActivities] = useState<Array<{ id: number; description?: string; action?: string; user_name?: string; created_at: string }>>([])
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [activeMention, setActiveMention] = useState<{ start: number; end: number; query: string } | null>(null)
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!task) return
    void Promise.all([api.get(`/tasks/${task.id}/comments`), api.get(`/tasks/${task.id}/activities`)]).then(([commentData, activityData]) => {
      setComments(Array.isArray(commentData) ? commentData : [])
      setActivities(Array.isArray(activityData) ? activityData : [])
    })
  }, [task])

  const mentionOptions = useMemo(() => team.map((member) => ({ handle: buildMentionHandle(member.name), name: member.name })), [team])
  const mentionLookup = useMemo(() => new Map(mentionOptions.map((m) => [m.handle, m.name])), [mentionOptions])
  const filteredMentionOptions = useMemo(() => {
    if (!activeMention) return []
    const q = activeMention.query.toLowerCase()
    return mentionOptions.filter((option) => !q || option.name.toLowerCase().includes(q) || option.handle.includes(q)).slice(0, 5)
  }, [activeMention, mentionOptions])

  if (!task) return null

  const handleDetailClose = () => {
    if (posting || statusUpdating) return
    onClose()
  }

  const postComment = async () => {
    if (!draft.trim()) return
    setPosting(true)
    try {
      const mentions = Array.from(new Set(Array.from(draft.matchAll(/@([A-Za-z0-9_.-]+)/g)).map((m) => m[1].toLowerCase()).filter((m) => mentionLookup.has(m))))
      await api.post(`/tasks/${task.id}/comments`, { text: draft, user_name: currentUser?.name || 'Team', mentions })
      setDraft('')
      setActiveMention(null)
      const [commentData, activityData] = await Promise.all([api.get(`/tasks/${task.id}/comments`), api.get(`/tasks/${task.id}/activities`)])
      setComments(Array.isArray(commentData) ? commentData : [])
      setActivities(Array.isArray(activityData) ? activityData : [])
      onRefresh()
    } finally {
      setPosting(false)
    }
  }

  const updateStatus = async (status: string) => {
    setStatusUpdating(true)
    try {
      await api.put(`/tasks/${task.id}/status`, { status })
      onRefresh()
      const activityData = await api.get(`/tasks/${task.id}/activities`)
      setActivities(Array.isArray(activityData) ? activityData : [])
    } finally {
      setStatusUpdating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 p-4" onClick={handleDetailClose}>
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{task.title}</h3>
            <p className="mt-1 text-sm text-slate-500">{task.description || 'No description added.'}</p>
          </div>
          <button onClick={handleDetailClose} disabled={posting || statusUpdating} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid max-h-[calc(90vh-76px)] gap-6 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap gap-2">
                {stages.map((stage) => (
                  <button key={stage.id} onClick={() => updateStatus(stage.name)} disabled={statusUpdating} className={cn('rounded-full border px-3 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-50', task.status === stage.name ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600')}>
                    {stage.name}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1"><Calendar className="h-4 w-4" />{task.due_date ? formatDate(task.due_date) : 'No due date'}</span>
                <span>{task.assigned_to.length ? task.assigned_to.map((member) => member.name).join(', ') : 'Unassigned'}</span>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-amber-500" />
                <h4 className="text-sm font-semibold text-slate-900">Comments</h4>
              </div>
              <div className="relative mt-4">
                <textarea
                  ref={textareaRef}
                  rows={3}
                  value={draft}
                  onChange={(event) => {
                    const value = event.target.value
                    setDraft(value)
                    setActiveMention(findActiveMention(value, event.target.selectionStart ?? value.length))
                  }}
                  onKeyDown={(event) => {
                    if (!activeMention || filteredMentionOptions.length === 0) return
                    if (event.key === 'ArrowDown') {
                      event.preventDefault()
                      setSelectedMentionIndex((index) => (index + 1) % filteredMentionOptions.length)
                    }
                    if (event.key === 'ArrowUp') {
                      event.preventDefault()
                      setSelectedMentionIndex((index) => (index - 1 + filteredMentionOptions.length) % filteredMentionOptions.length)
                    }
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      const option = filteredMentionOptions[selectedMentionIndex]
                      if (!option) return
                      const nextValue = `${draft.slice(0, activeMention.start)}@${option.handle} ${draft.slice(activeMention.end)}`
                      const nextCaret = activeMention.start + option.handle.length + 2
                      setDraft(nextValue)
                      setActiveMention(null)
                      requestAnimationFrame(() => {
                        textareaRef.current?.focus()
                        textareaRef.current?.setSelectionRange(nextCaret, nextCaret)
                      })
                    }
                  }}
                  placeholder="Add a comment… Type @ to mention a team member"
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
                />
                {activeMention && filteredMentionOptions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                    {filteredMentionOptions.map((option, index) => (
                      <button key={option.handle} type="button" onMouseDown={(event) => {
                        event.preventDefault()
                        const nextValue = `${draft.slice(0, activeMention.start)}@${option.handle} ${draft.slice(activeMention.end)}`
                        const nextCaret = activeMention.start + option.handle.length + 2
                        setDraft(nextValue)
                        setActiveMention(null)
                        requestAnimationFrame(() => {
                          textareaRef.current?.focus()
                          textareaRef.current?.setSelectionRange(nextCaret, nextCaret)
                        })
                      }} className={cn('flex w-full items-center gap-3 px-3 py-2 text-left', index == selectedMentionIndex ? 'bg-amber-50' : 'hover:bg-slate-50')}>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">{getInitials(option.name)}</div>
                        <span className="text-sm text-slate-700">{option.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-3 flex justify-end">
                <button onClick={postComment} disabled={posting || !draft.trim()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">{posting ? 'Posting...' : 'Post Comment'}</button>
              </div>
              <div className="mt-4 space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-800">{comment.user_name}</p>
                      <span className="text-xs text-slate-400">{formatRelativeTime(comment.created_at)}</span>
                    </div>
                    <div className="mt-2 text-sm text-slate-600">{renderMentionText(comment.text || '', mentionLookup)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 h-max">
            <h4 className="text-sm font-semibold text-slate-900">Activity</h4>
            <div className="mt-4 space-y-3">
              {activities.map((activity) => {
                const activityUserName = activity.user_name?.trim() || 'System'
                return (
                  <div key={activity.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-800">{activity.description || activity.action}</p>
                      <span className="text-xs text-slate-400">{formatRelativeTime(activity.created_at)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{activityUserName}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Tasks() {
  const { currentUser } = useAppStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tasks, setTasks] = useState<Task[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [stages, setStages] = useState<TaskStage[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'my' | 'all' | 'completed' | 'overdue'>('my')
  const [composerOpen, setComposerOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Handle ?new=true URL param — opens the task composer modal
  useEffect(() => {
    if (searchParams.get('new') === 'true' && !composerOpen) {
      setComposerOpen(true)
      searchParams.delete('new')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams, composerOpen])

  const isAdmin = ['admin', 'founder'].includes((currentUser?.role || '').toLowerCase())

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const query = new URLSearchParams()
      if (filter === 'my' && currentUser?.team_member_id) query.set('team_member_id', String(currentUser.team_member_id))
      if (filter === 'completed' || filter === 'overdue') query.set('filter', filter)
      const [tasksData, teamData, stageData] = await Promise.all([
        api.get(`/tasks${query.toString() ? `?${query.toString()}` : ''}`),
        api.get('/team'),
        api.get('/settings/task-stages'),
      ])
      setTasks(Array.isArray(tasksData) ? tasksData : [])
      setTeam(Array.isArray(teamData) ? teamData : [])
      setStages(Array.isArray(stageData) ? stageData : [])
    } finally {
      setLoading(false)
    }
  }, [filter, currentUser?.team_member_id])

  useEffect(() => { void fetchData() }, [fetchData])

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></div>
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tasks</h1>
          <p className="text-sm text-slate-500">Fast internal task management for the team.</p>
        </div>
        <button onClick={() => { setSelectedTask(null); setComposerOpen(true) }} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"><Plus className="h-4 w-4" />New Task</button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilter('my')} className={cn('rounded-full border px-3 py-1.5 text-sm', filter === 'my' ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600')}>My Tasks</button>
        {isAdmin && <button onClick={() => setFilter('all')} className={cn('rounded-full border px-3 py-1.5 text-sm', filter === 'all' ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600')}>All Tasks</button>}
        <button onClick={() => setFilter('completed')} className={cn('rounded-full border px-3 py-1.5 text-sm', filter === 'completed' ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600')}>Completed</button>
        <button onClick={() => setFilter('overdue')} className={cn('rounded-full border px-3 py-1.5 text-sm', filter === 'overdue' ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600')}>Overdue</button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="divide-y divide-slate-100">
          {tasks.length === 0 ? (
            <div className="px-5 py-16 text-center text-sm text-slate-400">No tasks found.</div>
          ) : tasks.map((task) => (
            <div key={task.id} className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1 cursor-pointer" onClick={() => { setSelectedTask(task); setDetailOpen(true) }}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-slate-900">{task.title}</p>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">{task.status}</span>
                </div>
                <p className="mt-1 truncate text-sm text-slate-500">{task.description || 'No description added.'}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <span>{task.assigned_to.length ? task.assigned_to.map((member) => member.name).join(', ') : 'Unassigned'}</span>
                  <span>{task.due_date ? `Due ${formatDate(task.due_date)}` : 'No due date'}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {stages.map((stage) => (
                  <button key={stage.id} onClick={() => api.put(`/tasks/${task.id}/status`, { status: stage.name }).then(() => fetchData())} className={cn('rounded-full border px-3 py-1.5 text-xs font-medium', task.status === stage.name ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600')}>
                    {stage.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <TaskComposer open={composerOpen} onClose={() => setComposerOpen(false)} onSaved={fetchData} task={selectedTask} team={team} stages={stages} currentUserTeamMemberId={currentUser?.team_member_id} />
      <TaskDetail task={detailOpen ? selectedTask : null} team={team} stages={stages} onClose={() => setDetailOpen(false)} onRefresh={fetchData} />
    </div>
  )
}
