import { useState } from 'react'
import type { ChatIntent, StructuredData, Report, AlertNotification } from '../../types'

interface IntentResultCardProps {
  intent: ChatIntent
  data: unknown
}

// ── Shared card wrapper ────────────────────────────────────────────────────────

function ResultCard({
  children,
  headerIcon,
  headerLabel,
}: {
  children: React.ReactNode
  headerIcon?: string
  headerLabel?: string
}) {
  return (
    <div
      style={{
        backgroundColor: 'var(--surface-alt, #F5F3EF)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        overflow: 'hidden',
        width: '100%',
        fontFamily: "'Inter', 'Noto Sans JP', sans-serif",
      }}
    >
      {(headerIcon || headerLabel) && (
        <div
          className="flex items-center gap-2 px-4 py-2.5"
          style={{
            backgroundColor: 'var(--primary-light)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {headerIcon && <span style={{ fontSize: 14 }}>{headerIcon}</span>}
          {headerLabel && (
            <span
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--primary)' }}
            >
              {headerLabel}
            </span>
          )}
        </div>
      )}
      <div className="px-4 py-3">{children}</div>
    </div>
  )
}

// ── Field row helper ───────────────────────────────────────────────────────────

function FieldRow({ label, value }: { label: string; value: string }) {
  if (!value || value === 'Not recorded' || value === '') return null
  return (
    <div className="flex gap-3 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
      <span
        className="text-xs font-medium flex-shrink-0"
        style={{ color: 'var(--text-secondary)', minWidth: 72 }}
      >
        {label}
      </span>
      <span className="text-xs leading-relaxed" style={{ color: 'var(--text)' }}>
        {value}
      </span>
    </div>
  )
}

function renderStructuredValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.join('、')
  if (typeof value === 'boolean') return value ? 'あり' : 'なし'
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== 'Not recorded')
      .map(([k, v]) => `${k}: ${v}`)
      .join(' / ')
  }
  return String(value)
}

// ── record_entry ───────────────────────────────────────────────────────────────

function RecordEntryCard({ data }: { data: unknown }) {
  // data may be a CareRecord (with .structuredData) or a raw StructuredData object
  let sd: Partial<StructuredData> | null = null

  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (d.structuredData && typeof d.structuredData === 'object') {
      sd = d.structuredData as Partial<StructuredData>
    } else {
      // Treat data itself as StructuredData
      sd = d as Partial<StructuredData>
    }
  }

  if (!sd) {
    return (
      <ResultCard headerIcon="📋" headerLabel="ケア記録">
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          記録データがありません
        </p>
      </ResultCard>
    )
  }

  const fields: { label: string; key: keyof StructuredData }[] = [
    { label: '食事', key: 'meal' },
    { label: '排泄', key: 'elimination' },
    { label: '睡眠', key: 'sleep' },
    { label: '服薬', key: 'medication' },
    { label: '身体状態', key: 'physical' },
    { label: '精神状態', key: 'mental' },
    { label: '転倒リスク', key: 'fall_risk' },
    { label: '提供ケア', key: 'care_given' },
    { label: '特記事項', key: 'special_notes' },
  ]

  return (
    <ResultCard headerIcon="📋" headerLabel="ケア記録（構造化済み）">
      <div>
        {fields.map(({ label, key }) => {
          const raw = sd?.[key]
          const value = renderStructuredValue(raw)
          return <FieldRow key={key} label={label} value={value} />
        })}
      </div>
    </ResultCard>
  )
}

// ── report_generation ──────────────────────────────────────────────────────────

function ReportCard({ data }: { data: unknown }) {
  let report: Partial<Report> | null = null
  if (data && typeof data === 'object') {
    report = data as Partial<Report>
  }

  const content = report?.generatedContent

  return (
    <ResultCard headerIcon="📄" headerLabel="月次レポート">
      {report?.periodStart && report?.periodEnd && (
        <p
          className="text-xs font-medium mb-2"
          style={{ color: 'var(--text-secondary)' }}
        >
          対象期間: {report.periodStart} 〜 {report.periodEnd}
        </p>
      )}
      {content ? (
        <div className="flex flex-col gap-1.5">
          {content.overall_assessment && (
            <FieldRow label="総合評価" value={content.overall_assessment} />
          )}
          {content.adl_summary && (
            <FieldRow label="ADL" value={content.adl_summary} />
          )}
          {content.mental_summary && (
            <FieldRow label="精神状態" value={content.mental_summary} />
          )}
          {content.incidents && (
            <FieldRow label="インシデント" value={content.incidents} />
          )}
          {content.handover_notes && (
            <FieldRow label="引継ぎ" value={content.handover_notes} />
          )}
        </div>
      ) : (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          レポート内容がありません
        </p>
      )}
    </ResultCard>
  )
}

// ── doctor_memo ────────────────────────────────────────────────────────────────

function DoctorMemoCard({ data }: { data: unknown }) {
  let memo = ''
  if (typeof data === 'string') {
    memo = data
  } else if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    memo = typeof d.memo === 'string' ? d.memo : typeof d.content === 'string' ? d.content : ''
  }

  return (
    <ResultCard headerIcon="🏥" headerLabel="診察メモ">
      {memo ? (
        <p
          className="text-xs leading-relaxed"
          style={{ color: 'var(--text)', whiteSpace: 'pre-wrap' }}
        >
          {memo}
        </p>
      ) : (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          メモ内容がありません
        </p>
      )}
    </ResultCard>
  )
}

// ── handover ───────────────────────────────────────────────────────────────────

function HandoverCard({ data }: { data: unknown }) {
  let summary = ''
  if (typeof data === 'string') {
    summary = data
  } else if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    summary =
      typeof d.summary === 'string'
        ? d.summary
        : typeof d.content === 'string'
        ? d.content
        : ''
  }

  return (
    <ResultCard headerIcon="📋" headerLabel="引継ぎサマリー">
      {summary ? (
        <p
          className="text-xs leading-relaxed"
          style={{ color: 'var(--text)', whiteSpace: 'pre-wrap' }}
        >
          {summary}
        </p>
      ) : (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          引継ぎ内容がありません
        </p>
      )}
    </ResultCard>
  )
}

// ── checklist ─────────────────────────────────────────────────────────────────

interface ChecklistCategory {
  category: string
  items: { text: string; done?: boolean }[]
}

function ChecklistCard({ data }: { data: unknown }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  let categories: ChecklistCategory[] = []

  if (Array.isArray(data)) {
    categories = data as ChecklistCategory[]
  } else if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (Array.isArray(d.checklist)) {
      categories = d.checklist as ChecklistCategory[]
    }
  }

  function toggle(key: string) {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <ResultCard headerIcon="✅" headerLabel="チェックリスト">
      {categories.length > 0 ? (
        <div className="flex flex-col gap-3">
          {categories.map((cat) => (
            <div key={cat.category}>
              <p
                className="text-xs font-semibold mb-1.5 uppercase tracking-wide"
                style={{ color: 'var(--primary)' }}
              >
                {cat.category}
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {cat.items.map((item) => {
                  const key = `${cat.category}::${item.text}`
                  const isChecked = !!checked[key]
                  return (
                    <li key={key}>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 8,
                          cursor: 'pointer',
                          fontSize: 12,
                          color: isChecked ? 'var(--text-tertiary)' : 'var(--text)',
                          textDecoration: isChecked ? 'line-through' : 'none',
                          lineHeight: 1.5,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggle(key)}
                          style={{ marginTop: 2, accentColor: 'var(--primary)', flexShrink: 0 }}
                        />
                        {item.text}
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          チェックリストがありません
        </p>
      )}
    </ResultCard>
  )
}

// ── alert_inquiry ──────────────────────────────────────────────────────────────

function severityLabel(severity: AlertNotification['severity']): { text: string; color: string; bg: string } {
  switch (severity) {
    case 'high': return { text: '緊急', color: 'var(--danger)', bg: 'var(--danger-light)' }
    case 'medium': return { text: '注意', color: 'var(--warning)', bg: 'var(--warning-light)' }
    default: return { text: '情報', color: '#3B82F6', bg: '#EFF6FF' }
  }
}

function AlertInquiryCard({ data }: { data: unknown }) {
  let alerts: Partial<AlertNotification>[] = []

  if (Array.isArray(data)) {
    alerts = data as Partial<AlertNotification>[]
  } else if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (Array.isArray(d.alerts)) {
      alerts = d.alerts as Partial<AlertNotification>[]
    }
  }

  return (
    <ResultCard headerIcon="🔔" headerLabel="アラート一覧">
      {alerts.length > 0 ? (
        <div className="flex flex-col gap-2">
          {alerts.map((alert, i) => {
            const label = alert.severity ? severityLabel(alert.severity) : { text: '情報', color: '#3B82F6', bg: '#EFF6FF' }
            return (
              <div
                key={alert.id ?? i}
                style={{
                  borderLeft: `3px solid ${label.color}`,
                  paddingLeft: 10,
                  paddingTop: 4,
                  paddingBottom: 4,
                }}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: label.bg, color: label.color }}
                  >
                    {label.text}
                  </span>
                  <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                    {alert.title ?? ''}
                  </span>
                </div>
                {alert.description && (
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {alert.description}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          アラートはありません
        </p>
      )}
    </ResultCard>
  )
}

// ── JSON fallback ──────────────────────────────────────────────────────────────

function JsonFallbackCard({ data }: { data: unknown }) {
  return (
    <ResultCard headerIcon="📦" headerLabel="結果">
      <pre
        className="text-xs leading-relaxed overflow-x-auto"
        style={{ color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    </ResultCard>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function IntentResultCard({ intent, data }: IntentResultCardProps) {
  switch (intent) {
    case 'record_entry':
      return <RecordEntryCard data={data} />
    case 'report_generation':
      return <ReportCard data={data} />
    case 'doctor_memo':
      return <DoctorMemoCard data={data} />
    case 'handover':
      return <HandoverCard data={data} />
    case 'checklist':
      return <ChecklistCard data={data} />
    case 'alert_inquiry':
      return <AlertInquiryCard data={data} />
    case 'general_chat':
    case 'guide_question':
      // No card for these — text is shown directly in the bubble
      return null
    default:
      // Unknown intent with data → show JSON fallback
      return data !== undefined && data !== null ? <JsonFallbackCard data={data} /> : null
  }
}
