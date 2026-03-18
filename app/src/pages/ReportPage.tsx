import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Download, CheckCircle, Loader2, Check } from 'lucide-react'
import { generateReport } from '../lib/api'
import type { ReportContent } from '../types'
import PrintableReport from '../components/PrintableReport'

const RECIPIENT_NAME = 'Setsuko Tanaka'
const AUTHOR_NAME = 'Care Staff'

function getPreviousMonth(): { start: string; end: string } {
  const now = new Date()
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const month = now.getMonth() === 0 ? 12 : now.getMonth()
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { num: 1, label: 'Settings' },
    { num: 2, label: 'Preview' },
    { num: 3, label: 'Done' },
  ]
  return (
    <div className="flex items-center justify-center py-6 px-8">
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-200"
              style={{
                backgroundColor: step >= s.num ? 'var(--primary)' : 'var(--border)',
                color: step >= s.num ? 'white' : 'var(--text-tertiary)',
              }}
            >
              {step > s.num ? <Check size={16} /> : s.num}
            </div>
            <span
              className="text-xs font-medium"
              style={{
                color: step >= s.num ? 'var(--primary)' : 'var(--text-tertiary)',
                fontWeight: step === s.num ? 700 : 400,
              }}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className="w-20 h-0.5 mx-2 mb-5 transition-all duration-200"
              style={{ backgroundColor: step > s.num ? 'var(--primary)' : 'var(--border)' }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ---- Step 1: Settings ----
interface Step1Props {
  periodStart: string
  periodEnd: string
  templateType: 'standard' | 'simple'
  additionalNotes: string
  isLoading: boolean
  onChangePeriodStart: (v: string) => void
  onChangePeriodEnd: (v: string) => void
  onChangeTemplate: (v: 'standard' | 'simple') => void
  onChangeNotes: (v: string) => void
  onGenerate: () => void
}

function Step1({
  periodStart, periodEnd, templateType, additionalNotes, isLoading,
  onChangePeriodStart, onChangePeriodEnd, onChangeTemplate, onChangeNotes, onGenerate,
}: Step1Props) {
  const labelClass = "block text-xs font-semibold tracking-wide uppercase mb-1.5"
  const inputClass = "w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all duration-200 focus:ring-2 bg-white"

  return (
    <div className="max-w-4xl mx-auto px-6">
      <div className="grid grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-5">
          {/* Care recipient */}
          <div>
            <label className={labelClass} style={{ color: 'var(--text-tertiary)' }}>Care Recipient</label>
            <div
              className="px-4 py-3 rounded-xl border text-sm font-medium bg-white"
              style={{ color: 'var(--text)', borderColor: 'var(--border)' }}
            >
              {RECIPIENT_NAME}
            </div>
          </div>

          {/* Period */}
          <div>
            <label className={labelClass} style={{ color: 'var(--text-tertiary)' }}>Reporting Period</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={periodStart}
                onChange={e => onChangePeriodStart(e.target.value)}
                className={inputClass}
                style={{ color: 'var(--text)', borderColor: 'var(--border)' }}
              />
              <span className="text-sm flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>to</span>
              <input
                type="date"
                value={periodEnd}
                onChange={e => onChangePeriodEnd(e.target.value)}
                className={inputClass}
                style={{ color: 'var(--text)', borderColor: 'var(--border)' }}
              />
            </div>
          </div>

          {/* Template type */}
          <div>
            <label className={labelClass} style={{ color: 'var(--text-tertiary)' }}>Template</label>
            <div className="flex gap-4">
              {(['standard', 'simple'] as const).map(type => (
                <label key={type} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="template"
                    value={type}
                    checked={templateType === type}
                    onChange={() => onChangeTemplate(type)}
                    className="sr-only"
                  />
                  <div
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200"
                    style={{ borderColor: templateType === type ? 'var(--primary)' : 'var(--border)' }}
                  >
                    {templateType === type && (
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--primary)' }} />
                    )}
                  </div>
                  <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {type === 'standard' ? 'Standard' : 'Simple'}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div>
          <label className={labelClass} style={{ color: 'var(--text-tertiary)' }}>Additional Notes (optional)</label>
          <textarea
            value={additionalNotes}
            onChange={e => onChangeNotes(e.target.value)}
            placeholder="Enter any special notes or notable events"
            className="w-full px-4 py-3 rounded-xl border text-sm resize-none outline-none transition-all duration-200 bg-white focus:ring-2"
            style={{
              color: 'var(--text)',
              borderColor: 'var(--border)',
              minHeight: '180px',
            }}
          />
        </div>
      </div>

      {/* Generate button */}
      <div className="mt-6">
        <button
          onClick={onGenerate}
          disabled={isLoading}
          className="w-full py-4 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all duration-200 hover:opacity-90"
          style={{ backgroundColor: isLoading ? 'var(--text-tertiary)' : 'var(--primary)' }}
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              AI is generating the report...
            </>
          ) : (
            'Generate Report'
          )}
        </button>
      </div>
    </div>
  )
}

// ---- Step 2: Preview ----
interface Step2Props {
  content: ReportContent
  periodStart: string
  periodEnd: string
  onChangeContent: (updated: ReportContent) => void
  onBack: () => void
  onComplete: () => void
}

function Step2({ content, periodStart, periodEnd, onChangeContent, onBack, onComplete }: Step2Props) {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
  const [copied, setCopied] = useState(false)

  const sections: { key: keyof ReportContent; label: string; num: number }[] = [
    { key: 'overall_assessment', label: 'Overall Assessment', num: 1 },
    { key: 'adl_summary', label: 'Physical & ADL Trends', num: 2 },
    { key: 'mental_summary', label: 'Cognitive & Mental Status', num: 3 },
    { key: 'incidents', label: 'Notable Events / Incidents', num: 4 },
    { key: 'handover_notes', label: 'Handover Notes for Next Month', num: 5 },
  ]

  const handleCopy = async () => {
    const text = [
      'MimamoAI Care Manager Monthly Report',
      `Care Recipient: ${RECIPIENT_NAME}`,
      `Reporting Period: ${periodStart} to ${periodEnd}`,
      `Created Date: ${today}`,
      '',
      ...sections.map(s => `${s.num}. ${s.label}\n${content[s.key]}`),
    ].join('\n\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="max-w-3xl mx-auto px-6 pb-8">
      {/* Document card */}
      <div
        className="bg-white rounded-2xl shadow-md overflow-hidden"
        style={{ border: '1px solid var(--border)' }}
      >
        {/* Document header */}
        <div
          className="px-8 py-5 text-center"
          style={{ backgroundColor: 'var(--primary-light)', borderBottom: '1px solid var(--border)' }}
        >
          <div
            className="text-xs font-semibold tracking-widest uppercase mb-1"
            style={{ color: 'var(--primary)' }}
          >
            MimamoAI
          </div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
            Care Manager Monthly Report
          </h2>
        </div>

        {/* Metadata */}
        <div
          className="px-8 py-4 grid grid-cols-2 gap-x-8 gap-y-2"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          {[
            { label: 'Care Recipient', value: RECIPIENT_NAME },
            { label: 'Author', value: AUTHOR_NAME },
            { label: 'Reporting Period', value: `${periodStart} to ${periodEnd}` },
            { label: 'Created Date', value: today },
          ].map(item => (
            <div key={item.label} className="flex items-baseline gap-2">
              <span className="text-xs font-semibold w-20 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                {item.label}
              </span>
              <span className="text-sm" style={{ color: 'var(--text)' }}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* Editable sections */}
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {sections.map(s => (
            <div key={s.key} className="px-8 py-5">
              <div className="flex items-center gap-2.5 mb-3">
                <span
                  className="w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-bold flex-shrink-0"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  {s.num}
                </span>
                <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  {s.label}
                </span>
              </div>
              <textarea
                value={content[s.key]}
                onChange={e => onChangeContent({ ...content, [s.key]: e.target.value })}
                rows={4}
                className="w-full px-0 py-1 text-sm leading-relaxed resize-none outline-none bg-transparent border-transparent border-b-2 transition-all duration-200 focus:border-b-[var(--primary)]"
                style={{ color: 'var(--text)' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-6 flex gap-3">
        <button
          onClick={handlePrint}
          className="flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 text-white transition-all duration-200 hover:opacity-90"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          <Download size={15} />
          Download PDF
        </button>
        <button
          onClick={handleCopy}
          className="flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 border transition-all duration-200 hover:bg-[var(--primary-light)]"
          style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}
        >
          <Copy size={15} />
          {copied ? 'Copied!' : 'Copy Text'}
        </button>
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl text-sm font-medium border transition-all duration-200 hover:bg-[var(--bg)]"
          style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}
        >
          Back
        </button>
        <button
          onClick={onComplete}
          className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:opacity-90"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          Save & Finish
        </button>
      </div>

      {/* Printable version (hidden, shown only during print) */}
      <PrintableReport
        recipientName={RECIPIENT_NAME}
        periodStart={periodStart}
        periodEnd={periodEnd}
        authorName={AUTHOR_NAME}
        createdDate={today}
        content={content}
      />
    </div>
  )
}

// ---- Step 3: Complete ----
function Step3({ onHome }: { onHome: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-20 gap-6">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center"
        style={{ backgroundColor: 'var(--primary-light)' }}
      >
        <CheckCircle size={44} style={{ color: 'var(--primary)' }} />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Report has been saved</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Ready for submission to Care Manager.
        </p>
      </div>
      <button
        onClick={onHome}
        className="px-10 py-3.5 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:opacity-90"
        style={{ backgroundColor: 'var(--primary)' }}
      >
        Back to Home
      </button>
    </div>
  )
}

// ---- Main Page ----
export default function ReportPage() {
  const navigate = useNavigate()
  const prev = getPreviousMonth()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [periodStart, setPeriodStart] = useState(prev.start)
  const [periodEnd, setPeriodEnd] = useState(prev.end)
  const [templateType, setTemplateType] = useState<'standard' | 'simple'>('standard')
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [reportContent, setReportContent] = useState<ReportContent | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const report = await generateReport(periodStart, periodEnd, additionalNotes, templateType)
      if (report.generatedContent) {
        setReportContent(report.generatedContent)
        setStep(2)
      } else {
        setError('Report generation failed. Please try again.')
      }
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ backgroundColor: 'var(--bg)', fontFamily: "'Inter', 'Noto Sans JP', sans-serif" }}
    >
      {/* Page header */}
      <div
        className="px-6 py-4 bg-white border-b flex-shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Report Generation</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          Create a monthly report for the Care Manager
        </p>
      </div>

      {/* Step indicator */}
      <StepIndicator step={step} />

      {/* Error banner */}
      {error && (
        <div
          className="mx-6 mb-4 px-4 py-3 rounded-xl text-sm border"
          style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA', color: '#DC2626' }}
        >
          {error}
        </div>
      )}

      {/* Step content */}
      <div className="flex-1 pb-12">
        {step === 1 && (
          <Step1
            periodStart={periodStart}
            periodEnd={periodEnd}
            templateType={templateType}
            additionalNotes={additionalNotes}
            isLoading={isLoading}
            onChangePeriodStart={setPeriodStart}
            onChangePeriodEnd={setPeriodEnd}
            onChangeTemplate={setTemplateType}
            onChangeNotes={setAdditionalNotes}
            onGenerate={handleGenerate}
          />
        )}
        {step === 2 && reportContent && (
          <Step2
            content={reportContent}
            periodStart={periodStart}
            periodEnd={periodEnd}
            onChangeContent={setReportContent}
            onBack={() => setStep(1)}
            onComplete={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <Step3 onHome={() => navigate('/')} />
        )}
      </div>
    </div>
  )
}
