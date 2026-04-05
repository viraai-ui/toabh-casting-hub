import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, Mic, Minimize2, SendHorizonal, Sparkles, Volume2, X } from 'lucide-react'
import { cn, formatRelativeTime } from '@/lib/utils'
import { ASSISTANT_SUGGESTIONS, queryAssistant, type AssistantMessage } from '@/lib/assistant'
import { useOverlay } from '@/hooks/useOverlayManager'

const WELCOME_MESSAGE: AssistantMessage = {
  id: 'assistant-welcome',
  role: 'assistant',
  text: 'Ask about today’s casting queue, delayed work, weekly assignments, or specific casting details.',
  createdAt: new Date().toISOString(),
}

export function CastingAssistant() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<AssistantMessage[]>([WELCOME_MESSAGE])
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const { openOverlay, closeOverlay } = useOverlay()

  useEffect(() => {
    if (open) {
      openOverlay('floating-casting-assistant', () => setOpen(false))
    } else {
      closeOverlay('floating-casting-assistant')
    }
  }, [closeOverlay, open, openOverlay])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open, loading])

  const canSubmit = input.trim().length > 0 && !loading
  const latestResponse = useMemo(() => [...messages].reverse().find((message) => message.response)?.response, [messages])

  const submitQuery = async (rawQuery: string) => {
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
            className="fixed bottom-24 right-4 z-50 w-[calc(100vw-2rem)] max-w-[420px] overflow-hidden rounded-[28px] border border-white/60 bg-slate-950 text-white shadow-[0_25px_80px_rgba(15,23,42,0.35)] backdrop-blur-2xl lg:bottom-6 lg:right-6"
          >
            <div className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.25),_transparent_55%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,41,59,0.94))] p-5">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                    <Sparkles className="h-5 w-5 text-amber-300" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-200/90">Casting concierge</p>
                    <h2 className="mt-1 text-lg font-semibold text-white">TOABH Assistant</h2>
                    <p className="mt-1 text-sm text-slate-300">Embedded dashboard answers from your live casting data.</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-full p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
                    aria-label="Minimize assistant"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-full p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
                    aria-label="Close assistant"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div ref={scrollRef} className="max-h-[60vh] space-y-4 overflow-y-auto bg-slate-950/95 px-4 py-4">
              {messages.map((message) => (
                <div key={message.id} className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[88%] rounded-2xl px-4 py-3 shadow-sm',
                    message.role === 'user'
                      ? 'bg-amber-500 text-white'
                      : 'border border-white/10 bg-white/6 text-slate-100'
                  )}>
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-inherit/70">
                      {message.role === 'assistant' ? <Bot className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                      <span>{message.role === 'assistant' ? 'Assistant' : 'You'}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6">{message.text}</p>
                    {message.response?.cards?.length ? (
                      <div className="mt-3 space-y-2">
                        {message.response.cards.map((card, index) => (
                          <div key={`${card.title}-${index}`} className="rounded-2xl border border-white/8 bg-black/20 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-white">{card.title}</p>
                                <p className="mt-1 text-sm text-slate-300">{card.subtitle}</p>
                              </div>
                              <div className="flex flex-wrap justify-end gap-1">
                                {card.chips.map((chip) => (
                                  <span key={chip} className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-amber-100">
                                    {chip}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {card.meta.length > 0 && (
                              <ul className="mt-3 space-y-1 text-xs leading-5 text-slate-300">
                                {card.meta.map((line) => (
                                  <li key={line}>{line}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-2 text-[11px] text-inherit/60">{formatRelativeTime(message.createdAt)}</p>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-slate-300">
                    Reading casting data…
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-white/10 bg-slate-950/95 p-4">
              <div className="mb-3 flex flex-wrap gap-2">
                {(latestResponse?.suggestions?.length ? latestResponse.suggestions : ASSISTANT_SUGGESTIONS).slice(0, 4).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void submitQuery(suggestion)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-amber-300/40 hover:bg-amber-400/10 hover:text-white"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              <div className="flex items-end gap-2 rounded-[24px] border border-white/10 bg-white/6 p-2 shadow-inner shadow-black/10">
                <button
                  type="button"
                  disabled
                  title="Voice input foundation ready for browser speech capture integration"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-dashed border-amber-300/35 bg-amber-400/10 text-amber-200 opacity-80"
                  aria-label="Voice input coming soon"
                >
                  <Mic className="h-4 w-4" />
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
                  placeholder="Ask about today, delays, weekly work, or a casting..."
                  className="max-h-28 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={!canSubmit}
                  onClick={() => void submitQuery(input)}
                  className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition',
                    canSubmit ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20 hover:bg-amber-400' : 'bg-white/8 text-slate-500'
                  )}
                  aria-label="Send assistant query"
                >
                  <SendHorizonal className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Volume2 className="h-3.5 w-3.5" />
                  Voice-ready UI hook is in place for speech capture integration.
                </div>
                <div className="hidden items-center gap-1 sm:flex">
                  <Bot className="h-3.5 w-3.5" />
                  Live dashboard context
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        whileHover={{ y: -2, scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-24 right-4 z-40 flex items-center gap-3 rounded-full border border-white/60 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,41,59,0.92))] px-4 py-3 text-left text-white shadow-[0_20px_60px_rgba(15,23,42,0.32)] ring-1 ring-black/5 backdrop-blur-xl lg:bottom-4 lg:right-4 lg:px-2.5"
        aria-label={open ? 'Hide assistant' : 'Open assistant'}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950 shadow-inner shadow-white/20">
          <Sparkles className="h-5 w-5" />
        </span>
        <span className="hidden min-w-0 sm:block lg:hidden">
          <span className="block text-xs uppercase tracking-[0.24em] text-amber-200/80">AI assistant</span>
          <span className="mt-0.5 block text-sm font-semibold">Ask the Casting Hub</span>
        </span>
      </motion.button>
    </>
  )
}
