import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Phone, MessageCircle, Loader2, Users, FileText, Activity, MessageSquare } from 'lucide-react'
import { api } from '@/lib/api'
import { cn, formatRelativeTime, getInitials } from '@/lib/utils'
import type { Casting, Client, TeamMember, PipelineStage, LeadSource, Activity as ActivityType, Comment } from '@/types'

interface CastingModalProps {
  open: boolean
  onClose: () => void
  casting: Casting | null
  onSave: () => void
}

const tabs = ['Overview', 'Team', 'Budget', 'Custom Fields', 'Activity', 'Notes']

export function CastingModal({ open, onClose, casting, onSave }: CastingModalProps) {
  const [activeTab, setActiveTab] = useState('Overview')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [pipeline, setPipeline] = useState<PipelineStage[]>([])
  const [sources, setSources] = useState<LeadSource[]>([])
  const [activities, setActivities] = useState<ActivityType[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [newNote, setNewNote] = useState('')

  const [form, setForm] = useState({
    client_name: '',
    client_company: '',
    client_contact: '',
    project_name: '',
    description: '',
    shoot_date_start: '',
    shoot_date_end: '',
    location: '',
    status: 'NEW',
    source: '',
    assigned_to: [] as number[],
    budget_min: '',
    budget_max: '',
  })

  useEffect(() => {
    if (open) {
      fetchData()
      if (casting) {
        setForm({
          client_name: casting.client_name || '',
          client_company: casting.client_company || '',
          client_contact: casting.client_contact || '',
          project_name: casting.project_name || '',
          description: casting.requirements || '',
          shoot_date_start: casting.shoot_date_start || '',
          shoot_date_end: casting.shoot_date_end || '',
          location: casting.location || '',
          status: casting.status || 'NEW',
          source: casting.source || '',
          assigned_to: casting.assigned_ids || [],
          budget_min: casting.budget_min?.toString() || '',
          budget_max: casting.budget_max?.toString() || '',
        })
      } else {
        setForm({
          client_name: '',
          client_company: '',
          client_contact: '',
          project_name: '',
          description: '',
          shoot_date_start: '',
          shoot_date_end: '',
          location: '',
          status: 'NEW',
          source: '',
          assigned_to: [],
          budget_min: '',
          budget_max: '',
        })
      }
    }
  }, [open, casting])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [clientsData, teamData, pipelineData, sourcesData] = await Promise.all([
        api.get('/clients'),
        api.get('/team'),
        api.get('/settings/pipeline'),
        api.get('/settings/sources'),
      ])
      setClients(clientsData)
      setTeamMembers(teamData)
      setPipeline(pipelineData)
      setSources(sourcesData)
    } catch (err) {
      console.error('Failed to fetch data:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchActivities = async () => {
    if (!casting) return
    try {
      const data = await api.get(`/activities?casting_id=${casting.id}`)
      setActivities(data)
    } catch (err) {
      console.error('Failed to fetch activities:', err)
    }
  }

  const fetchComments = async () => {
    if (!casting) return
    try {
      const data = await api.get(`/comments/${casting.id}`)
      setComments(data)
    } catch (err) {
      console.error('Failed to fetch comments:', err)
    }
  }

  useEffect(() => {
    if (activeTab === 'Activity' && casting) fetchActivities()
    if (activeTab === 'Notes' && casting) fetchComments()
  }, [activeTab, casting])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        budget_min: form.budget_min ? Number(form.budget_min) : null,
        budget_max: form.budget_max ? Number(form.budget_max) : null,
      }
      if (casting) {
        await api.put(`/castings/${casting.id}`, payload)
      } else {
        await api.post('/castings', payload)
      }
      onSave()
      onClose()
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleAddNote = async () => {
    if (!casting || !newNote.trim()) return
    try {
      await api.post('/comments', {
        casting_id: casting.id,
        content: newNote,
      })
      setNewNote('')
      fetchComments()
    } catch (err) {
      console.error('Failed to add note:', err)
    }
  }

  // Handle escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <div
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-4xl max-h-[90vh] glass rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/20">
              <h2 className="text-lg font-semibold text-slate-900">
                {casting ? 'Edit Casting' : 'New Casting'}
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-6 py-2 border-b border-white/20 bg-slate-50/50">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    activeTab === tab
                      ? 'bg-white text-amber-600 shadow-sm'
                      : 'text-slate-600 hover:bg-white/50'
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                </div>
              ) : (
                <form onSubmit={handleSubmit} id="casting-form">
                  {activeTab === 'Overview' && (
                    <div className="space-y-4">
                      {/* Client */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Client
                        </label>
                        <select
                          value={form.client_name}
                          onChange={(e) => {
                            const client = clients.find((c) => c.name === e.target.value)
                            setForm({
                              ...form,
                              client_name: e.target.value,
                              client_contact: client?.phone || '',
                              client_company: client?.company || '',
                            })
                          }}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        >
                          <option value="">Select client</option>
                          {clients.map((client) => (
                            <option key={client.id} value={client.name}>
                              {client.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Contact
                          </label>
                          <input
                            type="text"
                            value={form.client_contact}
                            onChange={(e) => setForm({ ...form, client_contact: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                            placeholder="Phone number"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Company
                          </label>
                          <input
                            type="text"
                            value={form.client_company}
                            onChange={(e) => setForm({ ...form, client_company: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                            placeholder="Company name"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Project Title
                        </label>
                        <input
                          type="text"
                          value={form.project_name}
                          onChange={(e) => setForm({ ...form, project_name: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                          placeholder="Project name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Description
                        </label>
                        <textarea
                          value={form.description}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                          placeholder="Requirements, notes..."
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Shoot Date
                          </label>
                          <input
                            type="date"
                            value={form.shoot_date_start}
                            onChange={(e) => setForm({ ...form, shoot_date_start: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            End Date
                          </label>
                          <input
                            type="date"
                            value={form.shoot_date_end}
                            onChange={(e) => setForm({ ...form, shoot_date_end: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Location
                          </label>
                          <input
                            type="text"
                            value={form.location}
                            onChange={(e) => setForm({ ...form, location: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                            placeholder="Location"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Status
                          </label>
                          <select
                            value={form.status}
                            onChange={(e) => setForm({ ...form, status: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                          >
                            {pipeline.map((stage) => (
                              <option key={stage.id} value={stage.name}>
                                {stage.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Source
                        </label>
                        <select
                          value={form.source}
                          onChange={(e) => setForm({ ...form, source: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        >
                          <option value="">Select source</option>
                          {sources.map((source) => (
                            <option key={source.id} value={source.name}>
                              {source.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* WhatsApp/Call buttons */}
                      {form.client_contact && (
                        <div className="flex gap-2">
                          <a
                            href={`tel:+91${form.client_contact}`}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl text-slate-700 hover:bg-slate-200 transition-colors"
                          >
                            <Phone className="w-4 h-4" />
                            Call
                          </a>
                          <a
                            href={`https://wa.me/91${form.client_contact}?text=Regarding ${form.project_name || 'your casting'}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-green-100 rounded-xl text-green-700 hover:bg-green-200 transition-colors"
                          >
                            <MessageCircle className="w-4 h-4" />
                            WhatsApp
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'Team' && (
                    <div className="space-y-4">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Team Members
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {teamMembers.map((member) => (
                          <label
                            key={member.id}
                            className={cn(
                              'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors',
                              form.assigned_to.includes(member.id)
                                ? 'border-amber-500 bg-amber-500/5'
                                : 'border-slate-200 hover:bg-slate-50'
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={form.assigned_to.includes(member.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setForm({
                                    ...form,
                                    assigned_to: [...form.assigned_to, member.id],
                                  })
                                } else {
                                  setForm({
                                    ...form,
                                    assigned_to: form.assigned_to.filter((id) => id !== member.id),
                                  })
                                }
                              }}
                              className="sr-only"
                            />
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-sm font-medium">
                              {getInitials(member.name)}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-slate-900">{member.name}</p>
                              <p className="text-xs text-slate-500">{member.role}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === 'Budget' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Budget Min (₹)
                          </label>
                          <input
                            type="number"
                            value={form.budget_min}
                            onChange={(e) => setForm({ ...form, budget_min: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Budget Max (₹)
                          </label>
                          <input
                            type="number"
                            value={form.budget_max}
                            onChange={(e) => setForm({ ...form, budget_max: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'Custom Fields' && (
                    <div className="space-y-4">
                      <p className="text-slate-500 text-sm">Custom fields will appear here once configured in Settings.</p>
                    </div>
                  )}

                  {activeTab === 'Activity' && (
                    <div className="space-y-4">
                      {activities.length === 0 ? (
                        <p className="text-slate-500 text-sm">No activity recorded yet.</p>
                      ) : (
                        activities.map((activity) => (
                          <div key={activity.id} className="flex items-start gap-3">
                            <div className={cn(
                              'w-8 h-8 rounded-lg flex items-center justify-center',
                              activity.type === 'CREATED' ? 'bg-green-100 text-green-600' :
                              activity.type === 'STATUS_CHANGED' ? 'bg-blue-100 text-blue-600' :
                              activity.type === 'ASSIGNED' ? 'bg-purple-100 text-purple-600' :
                              activity.type === 'COMMENTED' ? 'bg-amber-100 text-amber-600' :
                              'bg-slate-100 text-slate-600'
                            )}>
                              {activity.type === 'CREATED' && <Activity className="w-4 h-4" />}
                              {activity.type === 'STATUS_CHANGED' && <Activity className="w-4 h-4" />}
                              {activity.type === 'ASSIGNED' && <Users className="w-4 h-4" />}
                              {activity.type === 'COMMENTED' && <MessageSquare className="w-4 h-4" />}
                              {activity.type === 'UPDATED' && <FileText className="w-4 h-4" />}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-slate-700">{activity.details}</p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {activity.user_name} • {formatRelativeTime(activity.created_at)}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {activeTab === 'Notes' && (
                    <div className="space-y-4">
                      {/* Add note */}
                      <div className="flex gap-3">
                        <textarea
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          placeholder="Add a note..."
                          rows={2}
                          className="flex-1 px-3 py-2 border border-slate-200 rounded-xl bg-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        />
                        <button
                          type="button"
                          onClick={handleAddNote}
                          disabled={!newNote.trim()}
                          className="btn-primary self-end disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>

                      {/* Notes list */}
                      <div className="space-y-3">
                        {comments.map((comment) => (
                          <div key={comment.id} className="p-3 bg-slate-50 rounded-xl">
                            <p className="text-sm text-slate-700">{comment.content}</p>
                            <p className="text-xs text-slate-400 mt-1">
                              {comment.user_name} • {formatRelativeTime(comment.created_at)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </form>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/20 bg-slate-50/50">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="casting-form"
                disabled={saving}
                className="btn-primary flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Saving...' : 'Save Casting'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
