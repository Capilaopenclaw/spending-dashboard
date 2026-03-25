'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { useChatMessages } from '@/lib/queries'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { t } from '@spending-dashboard/shared'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Send, Bot, User, Loader2 } from 'lucide-react'

const SUGGESTIONS = ['chat.suggestion1', 'chat.suggestion2', 'chat.suggestion3'] as const

export default function ChatPage() {
  const language = useAppStore((s) => s.language)
  const { data: history } = useChatMessages()
  const queryClient = useQueryClient()
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamedText, setStreamedText] = useState('')
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Sync history on load
  useEffect(() => {
    if (history?.length) {
      setMessages(history.map((m) => ({ role: m.role, content: m.content })))
    }
  }, [history])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamedText])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return

    const userMsg = { role: 'user' as const, content: text.trim() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setStreaming(true)
    setStreamedText('')

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ message: text.trim(), stream: true }),
        }
      )

      if (!res.ok) throw new Error('Chat failed')

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value)
          // Parse SSE
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') break
              try {
                const parsed = JSON.parse(data)
                if (parsed.text) {
                  fullText += parsed.text
                  setStreamedText(fullText)
                }
              } catch {
                // Non-JSON data line, treat as text
                fullText += data
                setStreamedText(fullText)
              }
            }
          }
        }
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: fullText }])
      setStreamedText('')
      queryClient.invalidateQueries({ queryKey: ['chat-messages'] })
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: language === 'sk' ? 'Prepáč, nastala chyba. Skús to znova.' : 'Sorry, an error occurred. Please try again.' },
      ])
    } finally {
      setStreaming(false)
    }
  }, [streaming, language, queryClient])

  return (
    <div className="flex h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)] flex-col">
      <h1 className="text-2xl font-bold mb-4">{t('chat.title', language)}</h1>

      {/* Messages */}
      <Card className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !streaming && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Bot size={48} className="text-accent-primary/40" />
            <p className="text-text-secondary text-center text-sm max-w-sm">
              {language === 'sk'
                ? 'Opýtaj sa ma čokoľvek o tvojich financiách. Poznám tvoje transakcie za posledných 30 dní.'
                : 'Ask me anything about your finances. I know your transactions from the last 30 days.'}
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((key) => (
                <Button
                  key={key}
                  variant="secondary"
                  size="sm"
                  onClick={() => sendMessage(t(key, language))}
                >
                  {t(key, language)}
                </Button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            {msg.role === 'assistant' && (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-primary/20 flex-shrink-0">
                <Bot size={14} className="text-accent-primary" />
              </div>
            )}
            <div
              className={cn(
                'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-accent-primary text-bg-primary'
                  : 'bg-bg-elevated text-text-primary'
              )}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
            {msg.role === 'user' && (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-bg-elevated flex-shrink-0">
                <User size={14} className="text-text-secondary" />
              </div>
            )}
          </div>
        ))}

        {streaming && streamedText && (
          <div className="flex gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-primary/20 flex-shrink-0">
              <Bot size={14} className="text-accent-primary" />
            </div>
            <div className="max-w-[80%] rounded-2xl bg-bg-elevated px-4 py-2.5 text-sm leading-relaxed text-text-primary">
              <div className="whitespace-pre-wrap">{streamedText}</div>
              <span className="inline-block w-1.5 h-4 bg-accent-primary animate-pulse ml-0.5" />
            </div>
          </div>
        )}

        {streaming && !streamedText && (
          <div className="flex gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-primary/20 flex-shrink-0">
              <Bot size={14} className="text-accent-primary" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-bg-elevated px-4 py-2.5 text-sm text-text-secondary">
              <Loader2 size={14} className="animate-spin" />
              {language === 'sk' ? 'Premýšľam...' : 'Thinking...'}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </Card>

      {/* Input */}
      <div className="mt-3 flex gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              sendMessage(input)
            }
          }}
          placeholder={t('chat.placeholder', language)}
          rows={1}
          className="flex-1 resize-none rounded-lg border border-white/10 bg-bg-elevated px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
        />
        <Button onClick={() => sendMessage(input)} disabled={!input.trim() || streaming}>
          <Send size={16} />
        </Button>
      </div>
    </div>
  )
}
