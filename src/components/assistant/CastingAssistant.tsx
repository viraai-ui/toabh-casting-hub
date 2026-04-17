import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Mic, MicOff, Minimize2, SendHorizonal, Sparkles, X, ArrowUpRight } from 'lucide-react'
import { cn, formatRelativeTime } from '@/lib/utils'
import { ASSISTANT_SUGGESTIONS, queryAssistant, type AssistantMessage } from '@/lib/assistant'
import { useVoice, processVoiceQuery } from '@/hooks/useVoice'

const WELCOME_MESSAGE: AssistantMessage = {
  id: 'assistant-welcome',
  role: 'assistant',
  text: "Ask about today's queue, delays, weekly work, or any casting detail.",
  createdAt: new Date().toISOString(),
}

export function CastingAssistant() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [messages, setMessages] = useState<AssistantMessage[]>([WELCOME_MESSAGE])
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const processedRef = useRef('')

  const {
    state: voiceState,
    interimTranscript,
    startListening,
    stopListening,
    resetState,
  } = useVoice()

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open, loading])

  const canSubmit = input.trim().length > 0 && !loading
  const isListening = voiceState === 'requesting' || voiceState === 'listening'

  const submitQuery = useCallback(
    async (rawQuery: string) => {
      const query = rawQuery.trim()
      if (!query || loading) return

      const userMessage: AssistantMessage = {
        id: `${Date.now()}-user`,
        role: 'user',
        text: query,
        createdAt: new Date().toISOString(),
      }

      setMessages((current) => [...current, userMessage])
      setInput('')
      setLoading(true)

      try {
        const response = await queryAssistant(query)
        setMessages((current) => [
          ...current,
          {
            id: `${Date.now()}-assistant`,
            role: 'assistant',
            text: response.answer,
            response,
            createdAt: new Date().toISOString(),
          },
        ])
      } catch {
        setMessages((current) => [
          ...current,
          {
            id: `${Date.now()}-assistant-error`,
            role: 'assistant',
            text: 'I could not reach the casting data right now. Please try again in a moment.',
            createdAt: new Date().toISOString(),
          },
        ])
      } finally {
        setLoading(false)
      }
    },
    [loading],
  )

  useEffect(() => {
    if (voiceState === 'processing' && interimTranscript && interimTranscript !== processedRef.current) {
      processedRef.current = interimTranscript
      const { cleanQuery } = processVoiceQuery(interimTranscript)
      const query = cleanQuery.trim() || interimTranscript
      const timer = setTimeout(() => {
        void submitQuery(query)
        resetState()
        processedRef.current = ''
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [voiceState, interimTranscript, resetState, submitQuery])

  useEffect(() => {
    if (voiceState === 'idle' || voiceState === 'error') {
      processedRef.current = ''
    }
  }, [voiceState])

  const liveTranscript = isListening ? interimTranscript : ''

  const latestResponse = useMemo(
    () => [...messages].reverse().find((message) => message.response)?.response,
    [messages],
  )

  const conversationCount = Math.max(0, messages.length - 1)

  const toggleVoice = () => {
    if (isListening) {
      stopListening()
    } else {
      resetState()
      startListening()
    }
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-24 right-4 z-50 flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-[420px] flex-col overflow-hidden rounded-[28px] border border-white/60 bg-slate-950 text-white shadow-[0_25px_80px_rgba(15,23,42,0.35)] backdrop-blur-2xl lg:bottom-6 lg:right-6"
          >
            <div className="relative shrink-0 overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.25),_transparent_55%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,41,59,0.94))] px-4 py-3">
               <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />
               <div className="flex items-center justify-between gap-3">
@@
               <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-300/80">
                 <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Live workspace helper</span>
                 <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-1 text-amber-200">{conversationCount} exchanges</span>
               </div>
+
+              <div className="mt-3 rounded-2xl border border-amber-300/15 bg-white/5 px-3 py-2 text-[11px] leading-5 text-slate-300">
+                Use this concierge for quick operational answers before opening deeper casting records or jumping into edits.
+              </div>
             </div>
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                    <Sparkles className="h-4 w-4 text-amber-300" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold leading-tight text-white">Casting Concierge</h2>
                    <p className="mt-0.5 text-[11px] text-slate-300">Fast answers for queue, delays, assignments, and casting details.</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-full p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
                    aria-label="Minimize assistant"
                  >
                    <Minimize2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-full p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
                    aria-label="Close assistant"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-300/80">
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Live workspace helper</span>
                <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-1 text-amber-200">{conversationCount} exchanges</span>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 min-h-0 space-y-3 overflow-y-auto bg-slate-950/95 px-3 py-3">
              {messages.map((message) => (
                <div key={message.id} className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[88%] rounded-2xl px-3 py-2.5 shadow-sm',
                    message.role === 'user'
                      ? 'bg-amber-500 text-white'
                      : 'border border-white/10 bg-white/6 text-slate-100'
                  )}>
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-inherit/70">
                      <Sparkles className="h-3 w-3" />
                      <span>{message.role === 'assistant' ? 'Assistant' : 'You'}</span>
                    </div>
                    <p className="mt-1.5 text-[13px] leading-[1.55]">{message.text}</p>
                    {message.response?.cards?.length ? (
                      <div className="mt-2 space-y-2">
                        {message.response.cards.map((card, index) => (
                          <div key={`${card.title}-${index}`} className="rounded-2xl border border-white/8 bg-black/20 p-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-[13px] font-semibold text-white">{card.title}</p>
                                <p className="mt-0.5 text-[13px] text-slate-300">{card.subtitle}</p>
                              </div>
                              <div className="flex flex-wrap justify-end gap-1">
                                {card.chips.map((chip) => (
                                  <span key={chip} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-amber-100">
                                    {chip}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {card.meta.length > 0 && (
                              <ul className="mt-2 space-y-0.5 text-xs leading-5 text-slate-300">
                                {card.meta.map((line) => (
                                  <li key={line}>{line}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-1.5 text-[10px] text-inherit/60">{formatRelativeTime(message.createdAt)}</p>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-[13px] text-slate-300">
                    Reading casting data…
                  </div>
                </div>
              )}

              {voiceState === 'processing' && interimTranscript && (
                <div className="flex justify-end">
                  <div className={cn(
                    'max-w-[88%] rounded-2xl px-3 py-2.5',
                    'border border-amber-300/20 bg-amber-500/10 text-amber-100'
                  )}>
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-amber-200/70">
                      <Mic className="h-3 w-3" />
                      <span>Voice</span>
                    </div>
                    <p className="mt-1.5 text-[13px] leading-[1.55] italic opacity-80">{interimTranscript}</p>
                    <p className="mt-1 text-[10px] text-amber-200/50">Sending…</p>
                  </div>
                </div>
              )}

              {voiceState === 'error' && (
                <div className="flex justify-center">
                  <div className="rounded-2xl border border-red-300/20 bg-red-500/10 px-3 py-2 text-[13px] text-red-200">
                    Microphone not available. Please allow mic access in browser settings.
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-white/10 bg-slate-950/95 px-3 pb-3 pt-2">
              <div className="mb-2 rounded-2xl border border-white/8 bg-white/5 px-2.5 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Quick questions</p>
                    <p className="mt-1 text-[11px] text-slate-500">Use a prompt to jump straight into a useful answer.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSuggestions((v) => !v)}
                    className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[12px] font-medium text-slate-300 transition hover:text-white"
                  >
                    <span>{showSuggestions ? 'Hide' : 'Show'}</span>
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', showSuggestions && 'rotate-180')} />
                  </button>
                </div>
                <AnimatePresence>
                  {showSuggestions && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-wrap gap-1.5 pb-1 pt-2">
                        {(latestResponse?.suggestions?.length ? latestResponse.suggestions : ASSISTANT_SUGGESTIONS).map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => {
                              void submitQuery(suggestion)
                              setShowSuggestions(false)
                            }}
                            className="whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-200 transition hover:border-amber-300/40 hover:bg-amber-400/10 hover:text-white"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="mb-2 rounded-2xl border border-white/8 bg-black/10 px-3 py-2 text-[11px] leading-5 text-slate-400">
                Ask about delays, assignments, next actions, or the current queue to get a fast operational read.
              </div>

              {isListening && liveTranscript && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-2 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-1.5"
                >
                  <p className="text-[12px] leading-relaxed text-amber-200">{liveTranscript}</p>
                </motion.div>
              )}

              <div className="flex items-end gap-1.5 rounded-[24px] border border-white/10 bg-white/6 p-1.5 shadow-inner shadow-black/10">
                <button
                  type="button"
                  onClick={toggleVoice}
                  title={
                    voiceState === 'unsupported'
                      ? 'Voice not supported in this browser'
                      : isListening
                      ? 'Stop listening'
                      : 'Start voice input'
                  }
                  className={cn(
                    'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all',
                    isListening
                      ? 'border border-red-300/30 bg-red-500/20 text-red-400 animate-pulse'
                      : voiceState === 'unsupported'
                      ? 'cursor-not-allowed border border-white/5 bg-white/5 text-slate-600 opacity-50'
                      : 'border border-dashed border-amber-300/35 bg-amber-400/10 text-amber-200 hover:border-amber-300/60 hover:bg-amber-400/20',
                  )}
                  aria-label={isListening ? 'Stop listening' : 'Start voice input'}
                  disabled={voiceState === 'unsupported'}
                >
                  {isListening ? (
                    <>
                      <MicOff className="h-3.5 w-3.5" />
                      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-ping rounded-full bg-red-500" />
                    </>
                  ) : (
                    <Mic className="h-3.5 w-3.5" />
                  )}
                </button>

                <label className="sr-only" htmlFor="casting-assistant-input">Ask the assistant</label>
                <textarea
                  id="casting-assistant-input"
                  rows={1}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      void submitQuery(input)
                    }
                  }}
                  placeholder={isListening ? 'Listening… speak now' : 'Ask about today, delays, weekly work, or a casting...'}
                  className={cn(
                    'max-h-24 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[13px] text-white placeholder:text-slate-400 focus:outline-none',
                    isListening && 'text-amber-100',
                  )}
                />
                <button
                  type="button"
                  disabled={!canSubmit}
                  onClick={() => void submitQuery(input)}
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition',
                    canSubmit ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20 hover:bg-amber-400' : 'bg-white/8 text-slate-500'
                  )}
                  aria-label="Send assistant query"
                >
                  <SendHorizonal className="h-3.5 w-3.5" />
                </button>
              </div>

              <p className="mt-2 text-center text-[11px] text-slate-500">
                {voiceState === 'unsupported'
                  ? 'Voice input not supported in this browser. Use Chrome for best results.'
                  : isListening
                  ? 'Listening… tap mic to stop'
                  : 'Tap the mic or send a typed question for a quick workspace answer'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        whileHover={{ y: -2, scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-24 right-4 z-40 flex items-center gap-3 rounded-full border border-white/60 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,41,59,0.92))] px-4 py-3 text-left text-white shadow-[0_20px_60px_rgba(15,23,42,0.32)] ring-1 ring-black/5 backdrop-blur-xl lg:bottom-4 lg:right-4 lg:px-3"
        aria-label={open ? 'Hide assistant' : 'Open assistant'}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950 shadow-inner shadow-white/20">
          <Sparkles className="h-5 w-5" />
        </span>
        <span className="hidden min-w-0 sm:block lg:hidden">
          <span className="block text-xs uppercase tracking-[0.24em] text-amber-200/80">AI assistant</span>
          <span className="mt-0.5 block text-sm font-semibold">Ask the Casting Hub</span>
        </span>
        <span className="hidden items-center gap-1 text-xs font-medium text-amber-100/85 xl:inline-flex">
          Open
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </motion.button>
    </>
  )
}
