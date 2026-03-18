import { useState, useRef, useEffect } from 'react'
import type { KeyboardEvent, ChangeEvent } from 'react'
import { Send, Loader2 } from 'lucide-react'

interface ChatInputProps {
  onSend: (message: string) => void
  isLoading: boolean
  placeholder?: string
}

export default function ChatInput({ onSend, isLoading, placeholder }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-grow textarea up to 4 rows
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const lineHeight = 24 // approx 1.5rem
    const maxHeight = lineHeight * 4 + 24 // 4 rows + padding
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
  }, [value])

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || isLoading) return
    onSend(trimmed)
    setValue('')
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const canSend = value.trim().length > 0 && !isLoading

  return (
    <div
      className="flex items-end gap-3 px-4 py-3 border-t"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
        fontFamily: "'Inter', 'Noto Sans JP', sans-serif",
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        placeholder={placeholder ?? 'メッセージを入力... (Shift+Enterで改行)'}
        rows={1}
        className="flex-1 resize-none rounded-xl border px-4 py-3 text-sm leading-6 outline-none transition-all duration-200 disabled:opacity-60"
        style={{
          backgroundColor: 'var(--bg)',
          color: 'var(--text)',
          borderColor: 'var(--border)',
          minHeight: 48,
          maxHeight: 120,
          overflowY: 'auto',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--primary)'
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(45,90,61,0.12)'
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--border)'
          e.currentTarget.style.boxShadow = 'none'
        }}
      />
      <button
        onClick={handleSend}
        disabled={!canSend}
        className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-xl text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          backgroundColor: canSend ? 'var(--primary)' : 'var(--text-tertiary)',
        }}
        onMouseEnter={(e) => {
          if (canSend) e.currentTarget.style.backgroundColor = 'var(--primary-hover)'
        }}
        onMouseLeave={(e) => {
          if (canSend) e.currentTarget.style.backgroundColor = 'var(--primary)'
          else e.currentTarget.style.backgroundColor = 'var(--text-tertiary)'
        }}
        aria-label="送信"
      >
        {isLoading ? (
          <Loader2
            size={18}
            style={{ animation: 'spin 0.8s linear infinite' }}
          />
        ) : (
          <Send size={18} />
        )}
      </button>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
