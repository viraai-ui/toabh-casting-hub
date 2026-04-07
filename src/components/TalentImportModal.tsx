import { useState, useCallback, useRef, type DragEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Upload, FileSpreadsheet, Check, AlertCircle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'
import type { TalentImportResult } from '@/types'
import { toast } from 'sonner'

interface TalentImportModalProps {
  open: boolean
  onClose: () => void
  onImported: () => void
}

export function TalentImportModal({ open, onClose, onImported }: TalentImportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<TalentImportResult | null>(null)
  const [selectedUpdates, setSelectedUpdates] = useState<Map<number, boolean>>(new Map())
  const [skipIds, setSkipIds] = useState<number[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setStep(1)
    setFile(null)
    setDragActive(false)
    setUploading(false)
    setImporting(false)
    setResults(null)
    setSelectedUpdates(new Map())
    setSkipIds([])
  }, [])

  const handleClose = () => {
    if (importing) return
    reset()
    onClose()
  }

  const handleFile = (f: File) => {
    if (!f.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please upload a CSV file')
      return
    }
    setFile(f)
  }

  const handleDragState = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!dragActive) setDragActive(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragActive(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0])
  }

  const handlePreview = async () => {
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.upload('/talents/import', formData) as TalentImportResult
      setResults(res)

      // Initialize selectedUpdates map (default: update duplicates)
      const updateMap = new Map<number, boolean>()
      res.duplicates_existing.forEach((d) => updateMap.set(d.row_num, false)) // default = skip
      setSelectedUpdates(updateMap)
      setStep(2)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to parse CSV')
    } finally {
      setUploading(false)
    }
  }

  const handleImport = async () => {
    if (!results) return
    setImporting(true)

    // Build records for import
    const records = [...results.importable]

    // For duplicates, check user selection
    const updateExisting: Array<Record<string, string | number>> = []
    const skip: number[] = []

    results.duplicates_existing.forEach((d) => {
      const shouldUpdate = selectedUpdates.get(d.row_num)
      if (shouldUpdate) {
        updateExisting.push({
          id: d.existing_id,
          name: d.name,
          phone: d.phone,
          email: d.email,
          instagram_handle: d.name || '',
        })
      } else {
        skip.push(d.row_num)
      }
    })

    try {
      await api.post('/talents/import/confirm', { records, update_existing: updateExisting, skip_ids: skip })
      toast.success(results.importable.length > 0 ? `Imported ${results.importable.length} talent${results.importable.length > 1 ? 's' : ''}` : 'Import complete')
      setStep(3)
      onImported()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to import')
    } finally {
      setImporting(false)
    }
  }

  if (!open) return null

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[85vh] flex flex-col">
              {/* Header with steps */}
              <div className="px-6 py-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-amber-500" />
                    <h2 className="text-lg font-semibold text-slate-900">Import CSV</h2>
                  </div>
                  <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Step indicators */}
                <div className="flex items-center gap-2 mt-3">
                  {[
                    { n: 1, label: 'Upload' },
                    { n: 2, label: 'Review' },
                    { n: 3, label: 'Done' },
                  ].map(({ n, label }) => (
                    <div key={n} className="flex items-center gap-2">
                      <div
                        className={cnStep(n, step)}
                      >
                        {n < step ? <Check className="w-3.5 h-3.5" /> : n}
                      </div>
                      <span className={cn('text-xs font-medium', step >= n ? 'text-slate-700' : 'text-slate-400')}>
                        {label}
                      </span>
                      {n < 3 && (
                        <div className={cn('w-8 h-px', step > n ? 'bg-amber-500' : 'bg-slate-200')} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-5 overflow-y-auto flex-1">
                {/* Step 1: Upload */}
                {step === 1 && (
                  <div className="space-y-4">
                    <div
                      onDragEnter={handleDragState}
                      onDragOver={handleDragState}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={cn(
                        'rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer',
                        dragActive
                          ? 'border-amber-400 bg-amber-50/70'
                          : 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/30'
                      )}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                      />
                      <Upload className="w-10 h-10 mx-auto text-slate-400 mb-3" />
                      {file ? (
                        <div>
                          <p className="text-sm font-medium text-slate-900">{file.name}</p>
                          <p className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB — CSV file</p>
                          <p className="text-xs text-amber-600 mt-2 font-medium">Click or drop to replace</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-medium text-slate-700">Drop your CSV file here</p>
                          <p className="text-xs text-slate-500 mt-1">or click to browse</p>
                        </div>
                      )}
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4">
                      <p className="text-xs font-medium text-slate-700 mb-2">Expected CSV columns:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {['name', 'instagram_handle', 'phone', 'email'].map((col) => (
                          <span key={col} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-xs text-slate-600 font-mono">
                            {col}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-slate-400 mt-2">Column order doesn't matter — headers are auto-matched.</p>
                    </div>
                  </div>
                )}

                {/* Step 2: Review */}
                {step === 2 && results && (
                  <div className="space-y-4">
                    {/* Summary */}
                    <div className="grid grid-cols-2 gap-3">
                      <SummaryStat label="Parsed" value={results.total_rows} icon="📄" color="slate" />
                      <SummaryStat label="Importable" value={results.importable.length} icon="✅" color="green" />
                      <SummaryStat label="Duplicates" value={results.duplicates_existing.length} icon="⚠️" color="amber" />
                      <SummaryStat label="Errors" value={results.errors.length} icon="❌" color="red" />
                    </div>

                    {/* Importable table */}
                    {results.importable.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-emerald-700 mb-2">New records ({results.importable.length})</h3>
                        <div className="max-h-40 overflow-y-auto border rounded-xl">
                          <table className="w-full text-xs">
                            <thead className="bg-slate-50 sticky top-0">
                              <tr>
                                <th className="text-left px-3 py-2 font-medium text-slate-600">Name</th>
                                <th className="text-left px-3 py-2 font-medium text-slate-600">Phone</th>
                                <th className="text-left px-3 py-2 font-medium text-slate-600">Email</th>
                              </tr>
                            </thead>
                            <tbody>
                              {results.importable.map((r, i) => (
                                <tr key={i} className="border-t border-slate-50">
                                  <td className="px-3 py-1.5 text-slate-800">{r.name}</td>
                                  <td className="px-3 py-1.5 text-slate-600">{r.phone || '—'}</td>
                                  <td className="px-3 py-1.5 text-slate-600">{r.email || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Duplicates table */}
                    {results.duplicates_existing.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-amber-700 mb-2">Duplicates ({results.duplicates_existing.length})</h3>
                        <div className="max-h-40 overflow-y-auto border rounded-xl">
                          <table className="w-full text-xs">
                            <thead className="bg-slate-50 sticky top-0">
                              <tr>
                                <th className="text-left px-3 py-2 font-medium text-slate-600">CSV</th>
                                <th className="text-left px-3 py-2 font-medium text-slate-600">Existing</th>
                                <th className="text-left px-3 py-2 font-medium text-slate-600">Match</th>
                                <th className="text-center px-3 py-2 font-medium text-slate-600">Skip</th>
                              </tr>
                            </thead>
                            <tbody>
                              {results.duplicates_existing.map((d) => (
                                <tr key={d.row_num} className="border-t border-slate-50">
                                  <td className="px-3 py-1.5 text-slate-800">{d.name}</td>
                                  <td className="px-3 py-1.5 text-slate-600">{d.existing_name}</td>
                                  <td className="px-3 py-1.5 text-amber-600 text-[10px]">{d.matched_on}</td>
                                  <td className="px-3 py-1.5 text-center">
                                    <input
                                      type="checkbox"
                                      checked={!selectedUpdates.get(d.row_num)}
                                      onChange={(e) => {
                                        setSelectedUpdates((prev) => {
                                          const next = new Map(prev)
                                          next.set(d.row_num, !e.target.checked)
                                          return next
                                        })
                                      }}
                                      className="w-3.5 h-3.5 accent-amber-500"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">☑️ Checked = skip. Uncheck to update existing record instead.</p>
                      </div>
                    )}

                    {/* Errors table */}
                    {results.errors.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-red-700 mb-2">Errors ({results.errors.length})</h3>
                        <div className="max-h-32 overflow-y-auto border rounded-xl">
                          <table className="w-full text-xs">
                            <thead className="bg-red-50 sticky top-0">
                              <tr>
                                <th className="text-left px-3 py-1.5 font-medium text-red-600">Row</th>
                                <th className="text-left px-3 py-1.5 font-medium text-red-600">Reason</th>
                              </tr>
                            </thead>
                            <tbody>
                              {results.errors.map((err) => (
                                <tr key={err.row_num} className="border-t border-red-50">
                                  <td className="px-3 py-1 text-slate-600">{err.row_num}</td>
                                  <td className="px-3 py-1 text-red-600">{err.reason}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">These rows will be skipped during import.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Success */}
                {step === 3 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                      <Check className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">Import Complete!</h3>
                    <p className="text-sm text-slate-500">
                      {results ? `${results.importable.length} new talent${results.importable.length !== 1 ? 's' : ''} added` : 'Talents imported successfully'}
                    </p>
                    <p className="text-xs text-slate-400 mt-2">Your talent database has been updated.</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              {step !== 3 && (
                <div className="px-6 py-4 bg-slate-50 flex items-center justify-between border-t border-slate-100">
                  {step === 1 ? (
                    <>
                      <button
                        onClick={handleClose}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handlePreview}
                        disabled={!file || uploading}
                        className="flex items-center gap-2 px-5 py-2 bg-amber-500 text-white text-sm font-medium rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 shadow-sm"
                      >
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                        {uploading ? 'Parsing...' : 'Preview'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setStep(1)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Back
                      </button>
                      <button
                        onClick={handleImport}
                        disabled={importing || results?.importable.length === 0}
                        className="flex items-center gap-2 px-5 py-2 bg-amber-500 text-white text-sm font-medium rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 shadow-sm"
                      >
                        {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        {importing ? 'Importing...' : `Import ${results?.importable.length || 0}`}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ─── Sub-components ───────────────────────────── */

function SummaryStat({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  const bgClass = {
    slate: 'bg-slate-50 border-slate-200',
    green: 'bg-emerald-50 border-emerald-200',
    amber: 'bg-amber-50 border-amber-200',
    red: 'bg-red-50 border-red-200',
  }[color] || 'bg-slate-50 border-slate-200'

  return (
    <div className={`rounded-xl border ${bgClass} px-3 py-2.5`}>
      <p className="text-lg leading-none">{icon}</p>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  )
}

function cnStep(current: number, active: number) {
  const base = 'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-colors'
  if (current < active) return `${base} bg-amber-500 text-white`
  if (current === active) return `${base} bg-amber-500 text-white`
  return `${base} bg-slate-200 text-slate-500`
}
