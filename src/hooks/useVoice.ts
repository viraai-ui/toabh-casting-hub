import { useCallback, useRef, useState } from 'react'

export type VoiceState = 'idle' | 'requesting' | 'listening' | 'processing' | 'unsupported' | 'error'

interface UseVoiceReturn {
  state: VoiceState
  interimTranscript: string
  startListening: () => void
  stopListening: () => void
  resetState: () => void
}

// ─── Type-safe SpeechRecognition shim ──────────────────────────────────────
interface SRResult {
  transcript: string
  isFinal: boolean
}

interface SRResultList {
  [index: number]: SRResult[]
  length: number
}

interface SREvent {
  resultIndex: number
  results: SRResultList
}

interface SRErrorEvent {
  error: string
  message: string
}

interface RecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onstart: (() => void) | null
  onresult: ((e: SREvent) => void) | null
  onend: (() => void) | null
  onerror: ((e: SRErrorEvent) => void) | null
}

interface RecognitionConstructor {
  new (): RecognitionInstance
}

let RecognitionCtor: RecognitionConstructor | null = null
try {
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RecognitionCtor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null
  }
} catch {
  RecognitionCtor = null
}

const isSupported = RecognitionCtor !== null

// ─── Text normalization ────────────────────────────────────────────────────
export function normalizeVoiceText(raw: string): string {
  return raw
    .replace(/\b(um|uh|ah|like|you know|so basically|i mean)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

interface VoiceQueryResult {
  cleanQuery: string
  intent: string
}

function fuzzyMatch(query: string, keyword: string): boolean {
  if (keyword.length <= 3) return query.includes(keyword)
  let qi = 0
  let matched = 0
  for (const ch of keyword.toLowerCase()) {
    const idx = query.toLowerCase().indexOf(ch, qi)
    if (idx !== -1) {
      matched++
      qi = idx + 1
    }
  }
  return matched / keyword.length >= 0.75
}

export function processVoiceQuery(raw: string): VoiceQueryResult {
  const cleaned = normalizeVoiceText(raw)
  const lower = cleaned.toLowerCase()
  if (fuzzyMatch(lower, 'pending') || fuzzyMatch(lower, 'active')) return { cleanQuery: cleaned || 'show pending castings', intent: 'pending' }
  if (fuzzyMatch(lower, 'delay') || fuzzyMatch(lower, 'overdue') || fuzzyMatch(lower, 'late')) return { cleanQuery: cleaned || 'show delayed castings', intent: 'delayed' }
  if (fuzzyMatch(lower, 'today')) return { cleanQuery: cleaned || 'what is scheduled for today', intent: 'today' }
  if (fuzzyMatch(lower, 'week') || fuzzyMatch(lower, 'weekly')) return { cleanQuery: cleaned || 'show this week assignments', intent: 'weekly' }
  if (fuzzyMatch(lower, 'task')) return { cleanQuery: cleaned || 'show tasks', intent: 'tasks' }
  if (fuzzyMatch(lower, 'client')) return { cleanQuery: cleaned || 'show clients', intent: 'clients' }
  return { cleanQuery: cleaned, intent: 'general' }
}

// ─── Hook ──────────────────────────────────────────────────────────────────
export function useVoice(): UseVoiceReturn {
  const [state, setState] = useState<VoiceState>(isSupported ? 'idle' : 'unsupported')
  const [interimTranscript, setInterimTranscript] = useState('')
  const recognitionRef = useRef<RecognitionInstance | null>(null)

  const startListening = useCallback(() => {
    if (!isSupported) {
      setState('unsupported')
      return
    }

    setInterimTranscript('')
    setState('requesting')

    try {
      const recognition = new RecognitionCtor!()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'en-IN'

      recognition.onresult = (event: SREvent) => {
        let interim = ''
        let final = ''
        const results = event.results
        for (let i = event.resultIndex; i < results.length; i++) {
          const entry = results[i]
          const text = entry[0]?.transcript ?? ''
          if (entry[0]?.isFinal) {
            final += text
          } else {
            interim += text
          }
        }
        setInterimTranscript(interim || final)
        if (final) {
          setState('processing')
        }
      }

      recognition.onstart = () => setState('listening')

      recognition.onend = () => {
        setState(prev => (prev === 'processing' ? 'processing' : 'idle'))
        recognitionRef.current = null
      }

      recognition.onerror = (event: SRErrorEvent) => {
        if (event.error === 'not-allowed') {
          setState('error')
        } else if (event.error !== 'aborted') {
          setState('idle')
        }
        recognitionRef.current = null
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch {
      setState('error')
    }
  }, [])

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current
    if (rec) {
      rec.stop()
      recognitionRef.current = null
    }
  }, [])

  const resetState = useCallback(() => {
    setInterimTranscript('')
    setState('idle')
    const rec = recognitionRef.current
    if (rec) {
      try { rec.stop() } catch { /* ignore */ }
      recognitionRef.current = null
    }
  }, [])

  return { state, interimTranscript, startListening, stopListening, resetState }
}
