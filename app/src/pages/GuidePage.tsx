import { useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Send, Copy, Download, MessageCircle, RotateCcw } from 'lucide-react'
import { sendGuideMessage } from '../lib/api'
import type { GuideMessage } from '../types'

const QUICK_START_CARDS = [
  'How to apply for Long-term Care Insurance',
  'How to upgrade the care level',
  'What is caregiving leave?',
  'Certification renewal procedure',
]

function renderMessageContent(text: string) {
  const lines = text.split('\n')
  const elements: ReactNode[] = []
  let key = 0

  for (const line of lines) {
    const inlineBold = (src: string) =>
      src.split(/\*\*(.+?)\*\*/g).map((part, i) =>
        i % 2 === 1 ? <strong key={i}>{part}</strong> : part
      )

    if (/^\d+\.\s/.test(line)) {
      elements.push(
        <div key={key++} className="flex gap-1.5 my-0.5">
          <span className="font-semibold text-[var(--primary)]">{line.match(/^\d+/)?.[0]}.</span>
          <span>{inlineBold(line.replace(/^\d+\.\s/, ''))}</span>
        </div>
      )
    } else if (/^[・•\-]\s/.test(line)) {
      elements.push(
        <div key={key++} className="flex gap-1.5 my-0.5">
          <span className="text-[var(--accent)]">•</span>
          <span>{inlineBold(line.replace(/^[・•\-]\s/, ''))}</span>
        </div>
      )
    } else if (line.trim() === '') {
      elements.push(<div key={key++} className="h-2" />)
    } else {
      elements.push(<div key={key++}>{inlineBold(line)}</div>)
    }
  }
  return elements
}

function DocumentCard({ content }: { content: string }) {
  const [copied, setCopied] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePrint = () => {
    if (!printRef.current) return
    const el = printRef.current
    el.classList.add('printable-doc-active')
    window.print()
    el.classList.remove('printable-doc-active')
  }

  return (
    <div className="mt-3 rounded-2xl border overflow-hidden bg-white" style={{ borderColor: 'var(--border)' }}>
      <div
        className="px-4 py-2.5 text-xs font-semibold text-white"
        style={{ backgroundColor: 'var(--primary)' }}
      >
        Document Draft
      </div>
      <div ref={printRef} className="printable-doc">
        <textarea
          readOnly
          value={content}
          className="w-full p-4 text-xs leading-relaxed resize-none bg-white"
          style={{ color: 'var(--text)', minHeight: 120, outline: 'none', border: 'none' }}
          rows={6}
        />
      </div>
      <div className="flex gap-2 px-4 pb-3">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-200 hover:bg-[var(--primary-light)]"
          style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
        >
          <Copy size={12} />
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white transition-all duration-200 hover:opacity-90"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          <Download size={12} />
          Download PDF
        </button>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-1.5 items-center px-4 py-3 bg-white rounded-2xl rounded-tl-sm w-fit shadow-sm border" style={{ borderColor: 'var(--border)' }}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full inline-block"
          style={{
            backgroundColor: 'var(--text-tertiary)',
            animation: `typingBounce 1.2s ease-in-out infinite ${i * 0.15}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.6; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function extractDocumentContent(text: string): string | null {
  const markers = ['[Document Draft]', '[Application Draft]', '[Document Draft]']
  for (const marker of markers) {
    const idx = text.indexOf(marker)
    if (idx !== -1) {
      return text.slice(idx + marker.length).trim()
    }
  }
  return null
}

export default function GuidePage() {
  const [messages, setMessages] = useState<GuideMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [searchParams] = useSearchParams()
  const autoSentRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    if (searchParams.get('auto') === 'care_manager_report' && !autoSentRef.current) {
      autoSentRef.current = true
      sendMessage('[AUTO:care_manager_report] Please draft a message to the Care Manager')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return
    setError(null)

    const userMsg: GuideMessage = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await sendGuideMessage(sessionId, text)

      const newSessionId = res.headers.get('X-Session-Id')
      if (newSessionId) setSessionId(newSessionId)

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data)
            if (parsed.text) {
              setMessages(prev => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, content: last.content + parsed.text }
                }
                return updated
              })
            }
            if (parsed.session_id) setSessionId(parsed.session_id)
          } catch {
            // ignore parse errors on incomplete chunks
          }
        }
      }
    } catch {
      setError('A connection error occurred. Please try again.')
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickStart = (card: string) => {
    sendMessage(card)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleRetry = () => {
    setError(null)
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
    if (lastUserMsg) sendMessage(lastUserMsg.content)
  }

  // Collect all generated documents from assistant messages
  const generatedDocs = messages
    .filter(m => m.role === 'assistant')
    .map(m => extractDocumentContent(m.content))
    .filter((d): d is string => d !== null)
  const latestDoc = generatedDocs[generatedDocs.length - 1] ?? null

  return (
    <div
      className="flex flex-col h-screen"
      style={{ backgroundColor: 'var(--bg)', fontFamily: "'Inter', 'Noto Sans JP', sans-serif" }}
    >
      {/* Page header */}
      <div
        className="px-6 py-4 bg-white border-b flex-shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Procedure Guide</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          Ask AI anything about caregiving procedures
        </p>
      </div>

      {/* Main content: chat + side panel */}
      <div className="flex flex-1 overflow-hidden">

        {/* Chat area (65%) */}
        <div className="flex flex-col" style={{ width: '65%', borderRight: '1px solid var(--border)' }}>

          {/* Messages scroll area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">

            {/* Empty state */}
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-16">
                <MessageCircle size={48} style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-base font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Ask a question about procedures
                </p>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  Choose from the Quick Start panel on the right, or ask freely
                </p>
              </div>
            )}

            {/* Message list */}
            {messages.map((msg, i) => {
              const docContent = msg.role === 'assistant' ? extractDocumentContent(msg.content) : null
              const markerIdx = docContent ? msg.content.search(/\[(Document Draft|Application Draft)\]/) : -1
              const displayText = markerIdx !== -1 ? msg.content.slice(0, markerIdx) : msg.content

              return (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'user' ? (
                    <div
                      className="max-w-[70%] px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed text-white"
                      style={{ backgroundColor: 'var(--primary)' }}
                    >
                      {msg.content}
                    </div>
                  ) : (
                    <div className="max-w-[80%]">
                      <div
                        className="bg-white px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm border text-sm leading-relaxed"
                        style={{ color: 'var(--text)', borderColor: 'var(--border)' }}
                      >
                        {msg.content === '' && isLoading && i === messages.length - 1
                          ? <TypingIndicator />
                          : renderMessageContent(displayText)}
                      </div>
                      {docContent && <DocumentCard content={docContent} />}
                    </div>
                  )}
                </div>
              )
            })}

            {isLoading && messages.length > 0 && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex justify-start">
                <TypingIndicator />
              </div>
            )}

            {error && (
              <div
                className="rounded-xl p-3 flex items-center justify-between border"
                style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA' }}
              >
                <p className="text-sm text-red-600">{error}</p>
                <button
                  onClick={handleRetry}
                  className="ml-2 text-red-500 flex items-center gap-1 text-xs font-medium hover:text-red-700 transition-colors duration-200"
                >
                  <RotateCcw size={12} />
                  Retry
                </button>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <form
            onSubmit={handleSubmit}
            className="flex-shrink-0 flex items-center gap-3 px-4 py-4 bg-white border-t"
            style={{ borderColor: 'var(--border)' }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={isLoading}
              placeholder="Type your question..."
              className="flex-1 px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200 border focus:ring-2"
              style={{
                backgroundColor: 'var(--bg)',
                color: 'var(--text)',
                borderColor: 'var(--border)',
                '--tw-ring-color': 'var(--primary-light)',
              } as React.CSSProperties}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="flex items-center justify-center flex-shrink-0 px-4 h-11 rounded-xl text-white text-sm font-medium transition-all duration-200"
              style={{
                backgroundColor: !input.trim() || isLoading ? 'var(--text-tertiary)' : 'var(--primary)',
              }}
            >
              <Send size={16} />
            </button>
          </form>
        </div>

        {/* Side panel (35%) */}
        <div
          className="flex flex-col overflow-y-auto p-6 gap-6"
          style={{ width: '35%', backgroundColor: 'var(--bg)' }}
        >

          {/* Quick start */}
          <div>
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>
              Quick Start
            </h2>
            <div className="flex flex-col gap-2">
              {QUICK_START_CARDS.map(card => (
                <button
                  key={card}
                  onClick={() => handleQuickStart(card)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border text-sm text-left font-medium transition-all duration-200 hover:bg-[var(--primary-light)] hover:text-[var(--primary)] hover:border-[var(--primary)]"
                  style={{
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <MessageCircle size={15} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                  {card}
                </button>
              ))}
            </div>
          </div>

          {/* Generated documents */}
          {latestDoc && (
            <div>
              <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>
                Generated Document
              </h2>
              <DocumentCard content={latestDoc} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
