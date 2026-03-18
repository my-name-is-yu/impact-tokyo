import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronUp, FileText } from 'lucide-react'
import type { CareRecord, StructuredData } from '../types'
import { getRecords } from '../lib/api'

// ── Field definitions ──────────────────────────────────────────────────────

const FIELD_GROUPS: {
  groupLabel: string
  fields: { key: keyof StructuredData; label: string }[]
}[] = [
  {
    groupLabel: '食事・水分',
    fields: [{ key: 'meal', label: '食事' }],
  },
  {
    groupLabel: '排泄・睡眠',
    fields: [
      { key: 'elimination', label: '排泄' },
      { key: 'sleep', label: '睡眠' },
    ],
  },
  {
    groupLabel: '服薬・身体',
    fields: [
      { key: 'medication', label: '服薬' },
      { key: 'physical', label: '身体状態' },
    ],
  },
  {
    groupLabel: '精神・リスク',
    fields: [
      { key: 'mental', label: '精神状態' },
      { key: 'fall_risk', label: '転倒リスク' },
    ],
  },
  {
    groupLabel: '特記・ケア',
    fields: [
      { key: 'special_notes', label: '特記事項' },
      { key: 'care_given', label: 'ケア内容' },
    ],
  },
]

function renderFieldValue(value: StructuredData[keyof StructuredData]): string {
  if (value === null || value === undefined) return '—'
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join('、') : '—'
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value).filter(
      ([, v]) => v !== null && v !== undefined && v !== '' && v !== 'Not recorded'
    )
    return entries.length > 0
      ? entries.map(([k, v]) => `${k}: ${v}`).join(' / ')
      : '—'
  }
  if (typeof value === 'boolean') return value ? 'あり' : 'なし'
  return String(value) || '—'
}

function formatDatetime(date: string, time: string): string {
  if (!date) return '—'
  const d = new Date(`${date}T${time || '00:00'}`)
  if (isNaN(d.getTime())) return `${date} ${time || ''}`
  return d.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Field card ─────────────────────────────────────────────────────────────

function FieldCard({
  label,
  value,
}: {
  label: string
  value: StructuredData[keyof StructuredData]
}) {
  const displayValue = renderFieldValue(value)
  const isEmpty = displayValue === '—'
  return (
    <div
      className="rounded-xl px-4 py-3 border"
      style={{
        borderColor: 'var(--border)',
        backgroundColor: 'var(--bg)',
      }}
    >
      <div
        className="text-xs font-semibold uppercase tracking-wide mb-1.5"
        style={{ color: 'var(--text-secondary)' }}
      >
        {label}
      </div>
      <div
        className="text-sm leading-relaxed"
        style={{ color: isEmpty ? 'var(--text-tertiary)' : 'var(--text)' }}
      >
        {displayValue}
      </div>
    </div>
  )
}

// ── Collapsible raw input ──────────────────────────────────────────────────

function RawInputSection({ rawInput }: { rawInput: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--border)' }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium transition-colors duration-150"
        style={{
          backgroundColor: open ? 'var(--primary-light)' : 'var(--surface)',
          color: open ? 'var(--primary)' : 'var(--text-secondary)',
        }}
      >
        <span>元のテキスト入力を表示</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div
          className="px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap border-t"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--text)',
            backgroundColor: 'var(--bg)',
          }}
        >
          {rawInput || '（入力なし）'}
        </div>
      )}
    </div>
  )
}

// ── Status badge ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'draft' | 'saved' }) {
  const isDraft = status === 'draft'
  return (
    <span
      className="text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{
        backgroundColor: isDraft ? 'var(--warning-light)' : 'var(--primary-light)',
        color: isDraft ? 'var(--warning)' : 'var(--primary)',
      }}
    >
      {isDraft ? '下書き' : '保存済み'}
    </span>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function RecordDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [record, setRecord] = useState<CareRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    getRecords()
      .then((records) => {
        if (cancelled) return
        const found = records.find((r) => r.id === id) || null
        if (!found) {
          setError('記録が見つかりませんでした。')
        } else {
          setRecord(found)
        }
      })
      .catch(() => {
        if (!cancelled) setError('データの取得に失敗しました。')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  const s = record?.structuredData

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--bg)', fontFamily: "'Inter', 'Noto Sans JP', sans-serif" }}
    >
      {/* ── Header ── */}
      <div
        className="sticky top-0 z-10 px-6 py-4 border-b"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 flex-shrink-0"
            style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#d4e7da')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--primary-light)')}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold truncate" style={{ color: 'var(--text)' }}>
              ケア記録の詳細
            </h1>
            {record && (
              <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                {formatDatetime(record.recordDate, record.recordTime)}
              </p>
            )}
          </div>
          {record && <StatusBadge status={record.status} />}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div
              className="w-8 h-8 rounded-full border-2"
              style={{
                borderColor: 'var(--primary)',
                borderTopColor: 'transparent',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div
            className="rounded-xl p-5 flex items-start gap-3 border"
            style={{ backgroundColor: 'var(--danger-light)', borderColor: '#FECACA' }}
          >
            <FileText size={18} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
            <div>
              <p className="text-sm font-medium mb-2" style={{ color: 'var(--danger)' }}>
                {error}
              </p>
              <button
                onClick={() => navigate('/')}
                className="text-xs underline"
                style={{ color: 'var(--danger)' }}
              >
                ホームに戻る
              </button>
            </div>
          </div>
        )}

        {/* Record */}
        {!loading && record && (
          <div className="flex flex-col gap-6">

            {/* Date/time card */}
            <div
              className="rounded-2xl px-6 py-5 border"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div
                className="text-xs font-semibold uppercase tracking-wide mb-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                記録日時
              </div>
              <div className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
                {formatDatetime(record.recordDate, record.recordTime)}
              </div>
            </div>

            {/* No structured data */}
            {!s && (
              <div
                className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center px-8 py-16"
                style={{ borderColor: 'var(--border)' }}
              >
                <FileText size={32} className="mb-3" style={{ color: 'var(--border)' }} />
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  構造化データがありません
                </p>
              </div>
            )}

            {/* Structured data sections */}
            {s && FIELD_GROUPS.map((group) => (
              <div
                key={group.groupLabel}
                className="rounded-2xl border overflow-hidden"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <div
                  className="px-5 py-3 border-b"
                  style={{ backgroundColor: 'var(--primary-light)', borderColor: 'var(--border)' }}
                >
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--primary)' }}>
                    {group.groupLabel}
                  </span>
                </div>
                <div className="p-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {group.fields.map(({ key, label }) => (
                    <FieldCard key={key} label={label} value={s[key]} />
                  ))}
                </div>
              </div>
            ))}

            {/* Raw input collapsible */}
            {record.rawInput && <RawInputSection rawInput={record.rawInput} />}

          </div>
        )}
      </div>
    </div>
  )
}
