import { useCallback, useRef, useState } from 'react'

export type VoiceState = 'idle' | 'requesting' | 'listening' | 'processing' | 'unsupported' | 'error'

interface UseVoiceReturn {
  state: VoiceState
  interimTranscript: string
  startListening: () => void
  stopListening: () => void
  resetState: () => void
}

interface VoiceRecognitionEvent {
  resultIndex: number
  results: { [index: number]: { transcript: string; isFinal: boolean }[] }
}

let RecognitionCtor: typeof SpeechRecognition | null = null
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RecognitionCtor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null
}

const isSupported = RecognitionCtor !== null

function normalizeVoiceText(raw: string): string {
  // Clean up common voice recognition artifacts
  return raw
    // Remove filler words
    .replace(/\b(um|uh|ah|like|you know|so basically|i mean)\b/gi, '')
    // Fix common misrecognitions
    .replace(/\bcastings?\s+hub\b/gi, 'castings')
    .replace(/\bcasting is\b/gi, 'casting is')
    .replace(/\bhow many\b/gi, 'how many')
    .replace(/\bwhat are this week\b/gi, 'what is this week')
    .replace(/\bshow\b/gi, 'show')
    .replace(/\bsearch\b/gi, 'search')
    .replace(/\bfind\b/gi, 'find')
    .replace(/\btoday's?\b/gi, 'today')
    .replace(/\byesterday's?\b/gi, 'yesterday')
    .replace(/\bthis week'?s?\b/gi, 'this week')
    .replace(/\bnext week'?s?\b/gi, 'next week')
    // Collapse multiple spaces
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Web Speech API speech-to-text hook.
 * Handles mic permissions, listening states, interim results, and browser fallback.
 */
export function useVoice(): UseVoiceReturn {
  const [state, setState] = useState<VoiceState>(isSupported ? 'idle' : 'unsupported')
  const [interimTranscript, setInterimTranscript] = useState('')
  const recognitionRef = useRef<SpeechRecognition | null>(null)

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

      recognition.onresult = (event: unknown) => {
        const speechEvent = event as VoiceRecognitionEvent
        let interim = ''
        let final = ''
        for (let i = speechEvent.resultIndex; i < speechEvent.results.length; i++) {
          const t = speechEvent.results[i][0].transcript
          if (speechEvent.results[i].isFinal) {
            final += t
          } else {
            interim += t
          }
        }
        setInterimTranscript(interim || final)
        if (final) {
          setState('processing')
        }
      }

      recognition.onstart = () => {
        setState('listening')
      }

      recognition.onend = () => {
        setState(prev => (prev === 'processing' ? 'processing' : 'idle'))
        recognitionRef.current = null
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent | { error: string }) => {
        const err = 'error' in event ? event.error : 'unknown'
        if (err === 'not-allowed') {
          setState('error')
        } else if (err !== 'aborted') {
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
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    // Don't reset state — keep the transcript for the caller to read
  }, [])

  const resetState = useCallback(() => {
    setInterimTranscript('')
    setState('idle')
  }, [])

  return { state, interimTranscript, startListening, stopListening, resetState }
}

/**
 * Simple fuzzy matching for voice queries with typos.
 * Uses character-level similarity for short keywords.
 */
function fuzzyMatch(query: string, keyword: string): boolean {
  if (keyword.length <= 3) return query.includes(keyword)
  // Check if most characters appear in order (allows ~20% deletion)
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

/**
 * Normalize voice text and detect intent keywords.
 * Returns cleaned query with fallback for typo-heavy input.
 */
export function processVoiceQuery(raw: string): { cleanQuery: string; intent: string } {
  const cleaned = normalizeVoiceText(raw)

  // Intent detection from cleaned text
  const lower = cleaned.toLowerCase()
  if (fuzzyMatch(lower, 'pending') || fuzzyMatch(lower, 'active') || fuzzyMatch(lower, 'live')) {
    return { cleanQuery: cleaned || 'show pending castings', intent: 'pending castings' }
  }
  if (fuzzyMatch(lower, 'delay') || fuzzyMatch(lower, 'overdue') || fuzzyMatch(lower, 'late')) {
    return { cleanQuery: cleaned || 'show delayed castings', intent: 'delayed castings' }
  }
  if (fuzzyMatch(lower, 'today')) {
    return { cleanQuery: cleaned || 'what is scheduled for today', intent: 'today schedule' }
  }
  if (fuzzyMatch(lower, 'week') || fuzzyMatch(lower, 'weekly')) {
    return { cleanQuery: cleaned || 'show this week assignments', intent: 'weekly assignments' }
  }
  if (fuzzyMatch(lower, 'task')) {
    return { cleanQuery: cleaned || 'show tasks', intent: 'tasks' }
  }
  if (fuzzyMatch(lower, 'client')) {
    return { cleanQuery: cleaned || 'show clients', intent: 'clients' }
  }

  return { cleanQuery: cleaned, intent: 'general' }
}
