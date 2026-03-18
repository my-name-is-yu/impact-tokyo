import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer, Copy, Check, FileText } from 'lucide-react'
import type { Report, ReportContent } from '../types'
import PrintableReport from '../components/PrintableReport'

// ── Constants ──────────────────────────────────────────────────────────────

const RECIPIENT_NAME = '田中節子'
const AUTHOR_NAME = 'ケアスタッフ'

const SECTIONS: { key: keyof ReportContent; label: string; num: number }[] = [
  { key: 'overall_assessment', label: '総合評価', num: 1 },
  { key: 'adl_summary', label: 'ADLの状況', num: 2 },
  { key: 'mental_summary', label: '精神面の状況', num: 3 },
  { key: 'incidents', label: 'インシデント', num: 4 },
  { key: 'handover_notes', label: '引き継ぎ事項', num: 5 },
]

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function templateLabel(type: Report['templateType']): string {
  return type === 'simple' ? '簡易版' : '標準版'
}

// ── Section card ───────────────────────────────────────────────────────────

function SectionCard({
  num,
  label,
  content,
}: {
  num: number
  label: string
  content: string
}) {
  const isEmpty = !content || content.trim() === ''
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
    >
      <div
        className="px-5 py-3 flex items-center gap-3 border-b"
        style={{ backgroundColor: 'var(--primary-light)', borderColor: 'var(--border)' }}
      >
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          {num}
        </span>
        <span className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>
          {label}
        </span>
      </div>
      <div
        className="px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap"
        style={{ color: isEmpty ? 'var(--text-tertiary)' : 'var(--text)' }}
      >
        {isEmpty ? '（記載なし）' : content}
      </div>
    </div>
  )
}

// ── Meta row ───────────────────────────────────────────────────────────────

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span
        className="text-xs font-semibold w-24 flex-shrink-0 uppercase tracking-wide"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {label}
      </span>
      <span className="text-sm" style={{ color: 'var(--text)' }}>
        {value}
      </span>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

interface LocationState {
  report?: Report
}

export default function ReportDetailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LocationState | null
  const report = state?.report ?? null

  const [copied, setCopied] = useState(false)

  const content = report?.generatedContent ?? null
  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const handlePrint = () => {
    window.print()
  }

  const handleCopy = async () => {
    if (!content || !report) return
    const lines = [
      'MimamoAI ケアマネ月次報告書',
      `対象者: ${RECIPIENT_NAME}`,
      `報告期間: ${formatDate(report.periodStart)} 〜 ${formatDate(report.periodEnd)}`,
      `作成日: ${today}`,
      '',
      ...SECTIONS.map((s) => `${s.num}. ${s.label}\n${content[s.key]}`),
    ]
    await navigator.clipboard.writeText(lines.join('\n\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── No report in state ─────────────────────────────────────────────────

  if (!report || !content) {
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{ backgroundColor: 'var(--bg)', fontFamily: "'Inter', 'Noto Sans JP', sans-serif" }}
      >
        {/* Header */}
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
            <h1 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
              報告書の詳細
            </h1>
          </div>
        </div>

        {/* Empty state */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-20 gap-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--primary-light)' }}
          >
            <FileText size={28} style={{ color: 'var(--primary)' }} />
          </div>
          <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
            表示する報告書データがありません。
            <br />
            チャット画面から報告書を生成してください。
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200"
            style={{ backgroundColor: 'var(--primary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--primary-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--primary)')}
          >
            ホームに戻る
          </button>
        </div>
      </div>
    )
  }

  // ── Report view ────────────────────────────────────────────────────────

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
              ケアマネ月次報告書
            </h1>
            <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
              {formatDate(report.periodStart)} 〜 {formatDate(report.periodEnd)}
            </p>
          </div>
          {/* Action buttons in header */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200"
              style={{
                borderColor: 'var(--border)',
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--surface)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)'
                e.currentTarget.style.color = 'var(--primary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.color = 'var(--text-secondary)'
              }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'コピー済み' : 'コピー'}
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all duration-200"
              style={{ backgroundColor: 'var(--primary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--primary-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--primary)')}
            >
              <Printer size={13} />
              印刷 / PDF
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6">

        {/* Metadata card */}
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div
            className="px-6 py-4 text-center border-b"
            style={{ backgroundColor: 'var(--primary-light)', borderColor: 'var(--border)' }}
          >
            <div
              className="text-xs font-semibold tracking-widest uppercase mb-1"
              style={{ color: 'var(--primary)' }}
            >
              MimamoAI
            </div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
              ケアマネ月次報告書
            </h2>
          </div>
          <div className="px-6 py-4 grid grid-cols-2 gap-x-8 gap-y-2.5">
            <MetaRow label="対象者" value={RECIPIENT_NAME} />
            <MetaRow label="作成者" value={AUTHOR_NAME} />
            <MetaRow
              label="報告期間"
              value={`${formatDate(report.periodStart)} 〜 ${formatDate(report.periodEnd)}`}
            />
            <MetaRow label="作成日" value={today} />
            {report.recordCount != null && (
              <MetaRow label="記録件数" value={`${report.recordCount}件`} />
            )}
            <MetaRow label="テンプレート" value={templateLabel(report.templateType)} />
          </div>
        </div>

        {/* Report sections */}
        {SECTIONS.map((section) => (
          <SectionCard
            key={section.key}
            num={section.num}
            label={section.label}
            content={content[section.key]}
          />
        ))}

        {/* Bottom action bar */}
        <div
          className="rounded-2xl border p-4 flex gap-3"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <button
            onClick={handlePrint}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200"
            style={{ backgroundColor: 'var(--primary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--primary-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--primary)')}
          >
            <Printer size={15} />
            印刷 / PDF保存
          </button>
          <button
            onClick={handleCopy}
            className="flex-1 py-3 rounded-xl text-sm font-medium border flex items-center justify-center gap-2 transition-all duration-200"
            style={{
              borderColor: 'var(--primary)',
              color: 'var(--primary)',
              backgroundColor: 'var(--surface)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--primary-light)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface)')}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? 'コピー済み！' : 'テキストをコピー'}
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex-1 py-3 rounded-xl text-sm font-medium border transition-all duration-200"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--surface)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface)')}
          >
            ホームに戻る
          </button>
        </div>
      </div>

      {/* Printable version (hidden, visible only on print) */}
      <PrintableReport
        recipientName={RECIPIENT_NAME}
        periodStart={report.periodStart}
        periodEnd={report.periodEnd}
        authorName={AUTHOR_NAME}
        createdDate={today}
        content={content}
      />
    </div>
  )
}
