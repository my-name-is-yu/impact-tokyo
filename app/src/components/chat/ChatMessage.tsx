import type { ChatMessage as ChatMessageType } from '../../types'
import IntentResultCard from './IntentResultCard'

interface ChatMessageProps {
  message: ChatMessageType
}

function formatTime(date: Date): string {
  const d = date instanceof Date ? date : new Date(date)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div
      className="flex"
      style={{
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        animation: 'msgFadeIn 0.2s ease both',
        fontFamily: "'Inter', 'Noto Sans JP', sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: '75%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: isUser ? 'flex-end' : 'flex-start',
          gap: 4,
        }}
      >
        {/* Bubble */}
        <div
          className="px-4 py-3 text-sm leading-relaxed"
          style={{
            backgroundColor: isUser ? 'var(--primary)' : 'var(--surface)',
            color: isUser ? '#ffffff' : 'var(--text)',
            borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
            border: isUser ? 'none' : '1px solid var(--border)',
            boxShadow: isUser
              ? 'none'
              : '0 1px 3px rgba(0,0,0,0.04)',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
          }}
        >
          {message.content}
          {message.isStreaming && (
            <span
              style={{
                display: 'inline-block',
                width: 2,
                height: '1em',
                backgroundColor: isUser ? 'rgba(255,255,255,0.7)' : 'var(--primary)',
                marginLeft: 2,
                verticalAlign: 'text-bottom',
                animation: 'cursorBlink 0.9s step-end infinite',
              }}
            />
          )}
        </div>

        {/* Intent result card (assistant only) */}
        {!isUser && message.intent && message.resultData !== undefined && (
          <IntentResultCard intent={message.intent} data={message.resultData} />
        )}

        {/* Timestamp */}
        <span
          className="text-xs"
          style={{
            color: 'var(--text-tertiary)',
            paddingLeft: isUser ? 0 : 4,
            paddingRight: isUser ? 4 : 0,
          }}
        >
          {formatTime(message.timestamp)}
        </span>
      </div>

      <style>{`
        @keyframes msgFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
