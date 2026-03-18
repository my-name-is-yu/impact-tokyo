import { useEffect, useRef } from 'react'
import type { ChatMessage as ChatMessageType, ChatIntent } from '../types'
import ChatInput from '../components/chat/ChatInput'
import ChatMessage from '../components/chat/ChatMessage'

// ── Suggestion chip definitions ─────────────────────────────────────────────

interface SuggestionChip {
  label: string
  intent: ChatIntent
  message: string
}

const SUGGESTION_CHIPS: SuggestionChip[] = [
  { label: 'ケア記録を入力', intent: 'record_entry', message: 'ケア記録を入力したいです' },
  { label: '月次レポート作成', intent: 'report_generation', message: '月次レポートを作成してください' },
  { label: '介護の相談', intent: 'guide_question', message: '介護の手続きについて相談したいです' },
  { label: '受診メモ作成', intent: 'doctor_memo', message: '受診メモを作成してください' },
  { label: '引き継ぎ資料', intent: 'handover', message: '申し送り書を作成してください' },
  { label: 'チェックリスト', intent: 'checklist', message: '入院チェックリストを作成してください' },
]

// ── EmptyState ────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  onChipClick: (message: string) => void
  isLoading: boolean
}

function EmptyState({ onChipClick, isLoading }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center flex-1 px-6 py-12"
      style={{ fontFamily: "'Inter', 'Noto Sans JP', sans-serif" }}
    >
      {/* Logo mark */}
      <div
        className="flex items-center justify-center rounded-2xl mb-5"
        style={{
          width: 56,
          height: 56,
          backgroundColor: 'var(--primary-light)',
        }}
      >
        <span style={{ fontSize: 28 }}>🌿</span>
      </div>

      {/* Greeting */}
      <h2
        className="text-xl font-semibold mb-2 text-center"
        style={{ color: 'var(--text)', letterSpacing: '-0.01em' }}
      >
        こんにちは！
      </h2>
      <p
        className="text-sm text-center mb-8"
        style={{ color: 'var(--text-secondary)', maxWidth: 360, lineHeight: 1.7 }}
      >
        何かお手伝いできることはありますか？<br />
        下のボタンから始めるか、メッセージを直接入力してください。
      </p>

      {/* Suggestion chips */}
      <div
        className="flex flex-wrap justify-center gap-2"
        style={{ maxWidth: 480 }}
      >
        {SUGGESTION_CHIPS.map((chip) => (
          <button
            key={chip.intent}
            onClick={() => onChipClick(chip.message)}
            disabled={isLoading}
            className="rounded-full text-sm font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--surface-alt)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                const el = e.currentTarget
                el.style.backgroundColor = 'var(--primary-light)'
                el.style.color = 'var(--primary)'
                el.style.borderColor = 'var(--primary)'
              }
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget
              el.style.backgroundColor = 'var(--surface-alt)'
              el.style.color = 'var(--text-secondary)'
              el.style.borderColor = 'var(--border)'
            }}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── MessageList ───────────────────────────────────────────────────────────────

interface MessageListProps {
  messages: ChatMessageType[]
  isLoading: boolean
  endRef: React.RefObject<HTMLDivElement | null>
}

function MessageList({ messages, isLoading, endRef }: MessageListProps) {
  return (
    <div
      className="flex flex-col gap-4 px-6 py-6"
      style={{ fontFamily: "'Inter', 'Noto Sans JP', sans-serif" }}
    >
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}

      {/* Typing indicator — shown when loading but no streaming placeholder yet */}
      {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
        <div className="flex" style={{ justifyContent: 'flex-start' }}>
          <div
            className="flex items-center gap-1.5 px-4 py-3 rounded-2xl"
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: 'var(--text-tertiary)',
                  display: 'inline-block',
                  animation: `typingDot 1.2s ease-in-out infinite`,
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div ref={endRef} />

      <style>{`
        @keyframes typingDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30%            { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ── ChatPageProps ─────────────────────────────────────────────────────────────

export interface ChatPageProps {
  messages: ChatMessageType[]
  isLoading: boolean
  isStreaming: boolean
  sendMessage: (text: string) => Promise<void>
}

// ── ChatPage ──────────────────────────────────────────────────────────────────

export default function ChatPage({ messages, isLoading, isStreaming, sendMessage }: ChatPageProps) {
  const endRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const hasMessages = messages.length > 0

  return (
    <div
      className="flex flex-col h-full"
      style={{
        backgroundColor: 'var(--bg)',
        fontFamily: "'Inter', 'Noto Sans JP', sans-serif",
      }}
    >
      {/* ── Header ── */}
      <header
        className="flex items-center flex-shrink-0 px-6"
        style={{
          height: 56,
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span
          className="text-sm font-semibold"
          style={{ color: 'var(--text-secondary)' }}
        >
          田中節子さんのケア
        </span>
      </header>

      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {hasMessages ? (
          <MessageList messages={messages} isLoading={isLoading} endRef={endRef} />
        ) : (
          <EmptyState onChipClick={sendMessage} isLoading={isLoading} />
        )}
      </div>

      {/* ── Input ── */}
      <div className="flex-shrink-0">
        <ChatInput
          onSend={sendMessage}
          isLoading={isLoading || isStreaming}
          placeholder="メッセージを入力... (Shift+Enterで改行)"
        />
      </div>
    </div>
  )
}
