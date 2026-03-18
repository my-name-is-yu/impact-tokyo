import { useState, useRef, useEffect } from 'react'
import type { ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, X, Sparkles, RotateCcw, Save, AlertTriangle, FileText } from 'lucide-react'
import type { StructuredData, AlertNotification } from '../types'
import { structureRecord, saveRecord, getOrchestratorStatus, getAlerts } from '../lib/api'

function nowLocalDatetime(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const STRUCTURED_FIELDS: { key: keyof StructuredData; label: string }[] = [
  { key: 'meal', label: 'Meals' },
  { key: 'elimination', label: 'Elimination' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'medication', label: 'Medication' },
  { key: 'physical', label: 'Physical Condition' },
  { key: 'mental', label: 'Mental State' },
  { key: 'fall_risk', label: 'Fall Risk' },
  { key: 'special_notes', label: 'Special Notes' },
  { key: 'care_given', label: 'Care Provided' },
]

function renderFieldValue(_key: keyof StructuredData, value: StructuredData[keyof StructuredData]): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.join('、')
  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== 'Not recorded')
      .map(([k, v]) => `${k}: ${v}`)
      .join(' / ')
  }
  return String(value)
}

type Status = 'idle' | 'short' | 'loading' | 'done' | 'error'

const STRUCTURE_STEPS = [
  'Text received',
  'Extracting meal, elimination, sleep info...',
  'Analyzing physical & mental state...',
  'Generating structured data...',
]

const ANALYSIS_STEPS = [
  'Sending record to AI Orchestrator...',
  'Orchestrator analyzing patterns...',
  'Processing autonomous actions...',
]

const CHIPS = [
  'No appetite',
  'Ate well',
  'Bathroom ×N times',
  'Confusion',
  'Calm',
  'Slept well',
  'Fall risk',
  'Took medication',
]

const SAMPLE_TEXT =
  'No appetite since morning, barely ate at lunch either. Went to the bathroom 3 times, slight confusion in the evening. Took medication in the morning.'

const MEAL_BARS = [
  { label: '3 days ago', value: 80 },
  { label: '2 days ago', value: 45 },
  { label: 'Yesterday', value: 20 },
]

// ─── Step icon component ───────────────────────────────────────────────────

function StepIcon({ state }: { state: 'done' | 'active' | 'waiting' }) {
  if (state === 'done') {
    return (
      <span
        className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 transition-all duration-200"
        style={{ backgroundColor: 'var(--primary)' }}
      >
        ✓
      </span>
    )
  }
  if (state === 'active') {
    return (
      <span
        className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200"
        style={{
          borderColor: 'var(--warning)',
          borderTopColor: 'transparent',
          animation: 'spin 0.8s linear infinite',
        }}
      />
    )
  }
  return (
    <span
      className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200"
      style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
    />
  )
}

// ─── Step list ────────────────────────────────────────────────────────────

function StepList({ steps, currentStep }: { steps: string[]; currentStep: number }) {
  return (
    <div className="space-y-3">
      {steps.map((text, i) => {
        const state = i < currentStep ? 'done' : i === currentStep ? 'active' : 'waiting'
        return (
          <div key={i} className="flex items-center gap-3">
            <StepIcon state={state} />
            <span
              className="text-sm transition-all duration-200"
              style={{
                color:
                  state === 'done'
                    ? 'var(--primary)'
                    : state === 'active'
                    ? 'var(--warning)'
                    : 'var(--text-secondary)',
                opacity: state === 'waiting' ? 0.6 : 1,
              }}
            >
              {text}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Mini bar chart ────────────────────────────────────────────────────────

function MealBarChart() {
  return (
    <div className="mt-3">
      <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
        Meal intake over last 3 days
      </p>
      <div className="flex items-end gap-2 h-14">
        {MEAL_BARS.map((bar) => (
          <div key={bar.label} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t transition-all duration-500"
              style={{
                height: `${bar.value}%`,
                backgroundColor:
                  bar.value < 50
                    ? 'var(--danger)'
                    : bar.value < 70
                    ? 'var(--accent)'
                    : 'var(--primary)',
              }}
            />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {bar.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Post-save analysis modal ──────────────────────────────────────────────

function AnalysisModal({
  analysisStep,
  showResult,
  orchestratorActions,
  latestAlert,
  onCareManager,
  onHome,
}: {
  analysisStep: number
  showResult: boolean
  orchestratorActions: string[]
  latestAlert: AlertNotification | null
  onCareManager: () => void
  onHome: () => void
}) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full bg-white rounded-2xl p-8"
        style={{
          maxWidth: 512,
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          animation: 'fadeScale 0.25s ease both',
        }}
      >
        {!showResult ? (
          <>
            <h2
              className="text-base font-semibold mb-5 text-center"
              style={{ color: 'var(--text)' }}
            >
              AI is analyzing the record...
            </h2>
            <StepList steps={ANALYSIS_STEPS} currentStep={analysisStep} />
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-5">
              <Sparkles size={18} style={{ color: 'var(--accent)' }} />
              <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
                AI Orchestrator Results
              </h2>
            </div>

            {/* Show orchestrator actions */}
            <div className="mb-4 space-y-2">
              {orchestratorActions.map((action, i) => {
                const labels: Record<string, { text: string; color: string }> = {
                  'analyze_health_pattern': { text: 'Health pattern analyzed', color: 'var(--primary)' },
                  'create_alert': { text: 'Alert created', color: 'var(--danger)' },
                  'draft_care_manager_message': { text: 'Care manager message drafted', color: '#3B82F6' },
                  'suggest_report_generation': { text: 'Report generation suggested', color: 'var(--accent)' },
                }
                const label = labels[action] || { text: action, color: 'var(--text-secondary)' }
                return (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: label.color }}>✓</span>
                    <span style={{ color: 'var(--text)' }}>{label.text}</span>
                  </div>
                )
              })}
            </div>

            {/* Show alert details if one was created */}
            {latestAlert && (
              <div
                className="rounded-xl p-4 mb-4"
                style={{
                  backgroundColor: 'var(--accent-light)',
                  borderLeft: '4px solid var(--danger)',
                  border: '1px solid #FECACA',
                  borderLeftWidth: '4px',
                }}
              >
                <div className="flex items-start gap-2 mb-2">
                  <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
                  <p className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>
                    {latestAlert.title}
                  </p>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {latestAlert.description}
                </p>
                <MealBarChart />
              </div>
            )}

            {/* If no actions were taken */}
            {orchestratorActions.length === 0 && !latestAlert && (
              <div className="text-center py-4">
                <p className="text-sm" style={{ color: 'var(--primary)' }}>
                  No anomalies detected. Record saved successfully.
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-2 mt-5">
              {latestAlert && (
                <button
                  onClick={onCareManager}
                  className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200"
                  style={{ backgroundColor: 'var(--primary)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--primary-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--primary)')}
                >
                  Contact Care Manager
                </button>
              )}
              <button
                onClick={onHome}
                className="w-full py-3 rounded-xl font-medium text-sm border transition-all duration-200"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', backgroundColor: 'var(--surface)' }}
              >
                Back to Home
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes fadeScale {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function RecordPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [datetime, setDatetime] = useState(nowLocalDatetime())
  const [rawText, setRawText] = useState('')
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [structuredData, setStructuredData] = useState<StructuredData | null>(null)
  const [editableFields, setEditableFields] = useState<Record<string, string>>({})
  const [recordId, setRecordId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [savedOk, setSavedOk] = useState(false)

  const [processingStep, setProcessingStep] = useState(0)
  const apiDoneRef = useRef(false)

  const [showAnalysisModal, setShowAnalysisModal] = useState(false)
  const [analysisStep, setAnalysisStep] = useState(0)
  const [showAnalysisResult, setShowAnalysisResult] = useState(false)
  const [orchestratorActions, setOrchestratorActions] = useState<string[]>([])
  const [latestAlert, setLatestAlert] = useState<AlertNotification | null>(null)

  useEffect(() => {
    if (status === 'loading') {
      apiDoneRef.current = false
      setProcessingStep(0)

      setTimeout(() => setProcessingStep(1), 50)

      const schedule = [
        { offset: 500, step: 2 },
        { offset: 1500, step: 3 },
        { offset: 2500, step: 4 },
      ]

      const timers = schedule.map(({ offset, step }) =>
        setTimeout(() => {
          if (!apiDoneRef.current) setProcessingStep(step)
        }, offset)
      )

      return () => {
        timers.forEach(clearTimeout)
      }
    }
  }, [status])

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (photos.length + files.length > 5) {
      alert('Maximum 5 photos')
      return
    }
    const newPhotos = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }))
    setPhotos((prev) => [...prev, ...newPhotos])
    e.target.value = ''
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      const copy = [...prev]
      URL.revokeObjectURL(copy[index].preview)
      copy.splice(index, 1)
      return copy
    })
  }

  function handleChipClick(chip: string) {
    setRawText((prev) => (prev.trim() === '' ? chip : prev + ' ' + chip))
    if (status === 'short') setStatus('idle')
  }

  async function handleStructure() {
    if (rawText.trim().length < 5) {
      setStatus('short')
      return
    }

    setStatus('loading')
    setErrorMsg('')
    try {
      const imagesBase64 = await Promise.all(
        photos.map(
          ({ file }) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => resolve((reader.result as string).split(',')[1])
              reader.onerror = reject
              reader.readAsDataURL(file)
            })
        )
      )

      const result = await structureRecord(rawText, imagesBase64)

      apiDoneRef.current = true
      setProcessingStep(STRUCTURE_STEPS.length)

      setRecordId(result.id)
      setStructuredData(result.structuredData)

      const fields: Record<string, string> = {}
      STRUCTURED_FIELDS.forEach(({ key }) => {
        const val = result.structuredData[key]
        fields[key] = renderFieldValue(key, val)
      })
      setEditableFields(fields)
      setStatus('done')
    } catch {
      apiDoneRef.current = true
      setStatus('error')
      setErrorMsg('AI structuring failed. Please try again.')
    }
  }

  async function handleSave() {
    if (!recordId) return
    try {
      await saveRecord(recordId)
      setSavedOk(true)
      setShowAnalysisModal(true)
      setAnalysisStep(0)
      setShowAnalysisResult(false)

      // Animate steps
      const delays = [0, 600, 1200]
      delays.forEach((delay, i) => {
        setTimeout(() => setAnalysisStep(i + 1), delay)
      })

      // Poll orchestrator status for results
      let attempts = 0
      const pollInterval = setInterval(async () => {
        attempts++
        try {
          const status = await getOrchestratorStatus()
          if (status.actions && status.actions.length > 0 && status.timestamp) {
            clearInterval(pollInterval)
            setOrchestratorActions(status.actions)

            // Also fetch latest alerts to show details
            try {
              const alerts = await getAlerts()
              if (alerts.length > 0) {
                setLatestAlert(alerts[0])
              }
            } catch { /* ignore */ }

            setShowAnalysisResult(true)
          }
        } catch { /* ignore */ }

        // Timeout after 10 seconds, show results anyway
        if (attempts >= 20) {
          clearInterval(pollInterval)
          setShowAnalysisResult(true)
        }
      }, 500)

    } catch {
      setErrorMsg('Save failed. Please try again.')
    }
  }

  function handleRetry() {
    setStatus('idle')
    setStructuredData(null)
    setEditableFields({})
    setRecordId(null)
    setErrorMsg('')
    setSavedOk(false)
    setProcessingStep(0)
  }

  const activeStructureStep =
    status === 'loading' && processingStep < STRUCTURE_STEPS.length ? processingStep : -1

  return (
    <div
      className="w-full max-w-5xl mx-auto px-6 py-6"
      style={{ fontFamily: "'Inter', 'Noto Sans JP', sans-serif" }}
    >
      {/* ── Header ── */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200"
            style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = 'var(--primary-light)')
            }
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
            Care Record Entry
          </h1>
        </div>
        {/* Care recipient badge */}
        <div className="flex items-center gap-2.5 pl-1">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            節
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            Setsuko Tanaka
          </span>
          <span
            className="text-xs px-2.5 py-0.5 rounded-full"
            style={{
              backgroundColor: 'var(--primary-light)',
              color: 'var(--primary)',
            }}
          >
            Age 78 · Care Level 2
          </span>
        </div>
      </div>

      {/* ── Two-panel grid ── */}
      <div className="grid grid-cols-2 gap-8 items-start">

        {/* ════ LEFT: Input Panel ════ */}
        <div className="flex flex-col gap-5">

          {/* Date/time */}
          <div>
            <label
              className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
              style={{ color: 'var(--text-secondary)' }}
            >
              Record Date/Time
            </label>
            <input
              type="datetime-local"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
              className="w-full border rounded-xl px-3 py-2.5 text-sm transition-all duration-200"
              style={{
                borderColor: 'var(--border)',
                color: 'var(--text)',
                backgroundColor: 'var(--surface)',
                outline: 'none',
              }}
              onFocus={(e) => (e.currentTarget.style.boxShadow = '0 0 0 3px rgba(45,90,61,0.15)')}
              onBlur={(e) => (e.currentTarget.style.boxShadow = 'none')}
            />
          </div>

          {/* Quick chips */}
          {status !== 'done' && (
            <div>
              <label
                className="block text-xs font-medium mb-2 uppercase tracking-wide"
                style={{ color: 'var(--text-secondary)' }}
              >
                Quick Phrases
              </label>
              <div className="flex flex-wrap gap-2">
                {CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => handleChipClick(chip)}
                    className="text-xs px-3 py-1.5 rounded-full border transition-all duration-200"
                    style={{
                      borderColor: 'var(--border)',
                      color: 'var(--text-secondary)',
                      backgroundColor: 'var(--surface)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--primary-light)'
                      e.currentTarget.style.color = 'var(--primary)'
                      e.currentTarget.style.borderColor = 'var(--primary)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--surface)'
                      e.currentTarget.style.color = 'var(--text-secondary)'
                      e.currentTarget.style.borderColor = 'var(--border)'
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Textarea */}
          <div>
            <label
              className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
              style={{ color: 'var(--text-secondary)' }}
            >
              Free-text observation & care notes
            </label>
            <textarea
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value)
                if (status === 'short') setStatus('idle')
              }}
              placeholder="e.g. No appetite since morning, barely ate at lunch. Went to the bathroom 3 times, slight confusion in the evening."
              className="w-full border rounded-xl px-4 py-3 text-sm resize-none leading-relaxed transition-all duration-200"
              style={{
                borderColor: status === 'short' ? 'var(--warning)' : 'var(--border)',
                color: 'var(--text)',
                backgroundColor: 'var(--surface)',
                minHeight: '240px',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(45,90,61,0.15)'
                e.currentTarget.style.borderColor = 'var(--primary)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.borderColor = status === 'short' ? 'var(--warning)' : 'var(--border)'
              }}
              disabled={status === 'loading' || status === 'done'}
            />
            {status === 'short' && (
              <div
                className="flex items-start gap-2 mt-2 text-xs"
                style={{ color: 'var(--warning)' }}
              >
                <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                <span>Input is too brief, please add more details</span>
              </div>
            )}
          </div>

          {/* Photo upload */}
          <div>
            <label
              className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
              style={{ color: 'var(--text-secondary)' }}
            >
              Add Photos{' '}
              <span style={{ color: 'var(--text-secondary)', opacity: 0.6, textTransform: 'none' }}>
                (up to 5)
              </span>
            </label>
            <div
              className="rounded-xl border-2 border-dashed p-4 flex flex-wrap gap-3 items-center transition-all duration-200"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}
            >
              {photos.map((p, i) => (
                <div
                  key={i}
                  className="relative w-16 h-16 rounded-lg overflow-hidden border"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <img src={p.preview} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
                  >
                    <X size={10} color="#fff" />
                  </button>
                </div>
              ))}
              {photos.length < 5 && status !== 'done' && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 rounded-lg flex flex-col items-center justify-center gap-1 transition-all duration-200"
                  style={{
                    border: '2px dashed var(--border)',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'transparent',
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
                  <Camera size={18} />
                  <span className="text-xs">Add</span>
                </button>
              )}
              {photos.length === 0 && status !== 'done' && (
                <span className="text-xs ml-1" style={{ color: 'var(--text-secondary)' }}>
                  Add photos here
                </span>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>

          {/* Error state */}
          {status === 'error' && (
            <div
              className="rounded-xl p-4 flex items-start gap-3"
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
              }}
            >
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
              <div className="flex-1">
                <p className="text-sm mb-1.5" style={{ color: 'var(--danger)' }}>
                  {errorMsg}
                </p>
                <button
                  onClick={() => { setStatus('idle'); setErrorMsg('') }}
                  className="text-xs font-semibold underline"
                  style={{ color: 'var(--danger)' }}
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* AI structure button */}
          {status !== 'done' && (
            <div className="flex flex-col gap-2">
              <button
                onClick={handleStructure}
                disabled={status === 'loading'}
                className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm text-white transition-all duration-200 disabled:opacity-60"
                style={{ backgroundColor: 'var(--primary)' }}
                onMouseEnter={(e) => {
                  if (status !== 'loading')
                    e.currentTarget.style.backgroundColor = 'var(--primary-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--primary)'
                }}
              >
                <Sparkles size={17} />
                {status === 'loading' ? 'AI is structuring the record...' : 'Structure with AI'}
              </button>
              <button
                onClick={() => {
                  setRawText(SAMPLE_TEXT)
                  if (status === 'short') setStatus('idle')
                }}
                className="text-sm text-center transition-all duration-200"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
              >
                Sample Input
              </button>
            </div>
          )}
        </div>

        {/* ════ RIGHT: Output Panel ════ */}
        <div className="flex flex-col gap-5">

          {/* Empty state */}
          {(status === 'idle' || status === 'short') && (
            <div
              className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center px-8 py-16"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--bg)',
                minHeight: '420px',
              }}
            >
              <FileText
                size={36}
                className="mb-3"
                style={{ color: 'var(--border)' }}
              />
              <p className="text-sm" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
                After AI structuring,
                <br />
                results will appear here
              </p>
            </div>
          )}

          {/* Loading: step visualization */}
          {status === 'loading' && (
            <div
              className="rounded-2xl p-6"
              style={{
                backgroundColor: 'var(--surface)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                minHeight: '420px',
              }}
            >
              <p className="text-sm font-medium mb-5" style={{ color: 'var(--text)' }}>
                Structuring...
              </p>
              <StepList steps={STRUCTURE_STEPS} currentStep={activeStructureStep} />
            </div>
          )}

          {/* Error: right panel placeholder */}
          {status === 'error' && (
            <div
              className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center px-8 py-16"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--bg)',
                minHeight: '420px',
              }}
            >
              <FileText size={36} className="mb-3" style={{ color: 'var(--border)' }} />
              <p className="text-sm" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
                Structuring failed
              </p>
            </div>
          )}

          {/* Done: structured result */}
          {status === 'done' && structuredData && (
            <div
              className="rounded-2xl p-6 flex flex-col gap-4"
              style={{
                backgroundColor: 'var(--surface)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <div className="flex items-center gap-2">
                <Sparkles size={15} style={{ color: 'var(--accent)' }} />
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  Structured Record
                </h2>
                <span className="ml-auto text-xs" style={{ color: 'var(--text-secondary)' }}>
                  You can edit each field
                </span>
              </div>

              {/* 2-column grid of field cards */}
              <div className="grid grid-cols-2 gap-3">
                {STRUCTURED_FIELDS.map(({ key, label }) => (
                  <div
                    key={key}
                    className={`rounded-xl border px-4 py-3 transition-all duration-200 ${
                      key === 'care_given' ? 'col-span-2' : ''
                    }`}
                    style={{
                      borderColor: 'var(--border)',
                      backgroundColor: 'var(--bg)',
                    }}
                  >
                    <label
                      className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {label}
                    </label>
                    <textarea
                      value={editableFields[key] || ''}
                      onChange={(e) =>
                        setEditableFields((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      rows={2}
                      className="w-full text-sm resize-none outline-none leading-relaxed bg-transparent"
                      style={{ color: 'var(--text)', minHeight: 40 }}
                    />
                  </div>
                ))}
              </div>

              {/* Save / Retry buttons */}
              {!savedOk && (
                <div className="flex gap-3 mt-1">
                  <button
                    onClick={handleRetry}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border font-medium text-sm transition-all duration-200"
                    style={{
                      borderColor: 'var(--border)',
                      color: 'var(--text-secondary)',
                      backgroundColor: 'var(--surface)',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor = 'var(--text-secondary)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.borderColor = 'var(--border)')
                    }
                  >
                    <RotateCcw size={15} />
                    Redo
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm text-white transition-all duration-200"
                    style={{ backgroundColor: 'var(--primary)' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = 'var(--primary-hover)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = 'var(--primary)')
                    }
                  >
                    <Save size={15} />
                    Save
                  </button>
                </div>
              )}
              {errorMsg && (
                <p className="text-xs text-center" style={{ color: 'var(--danger)' }}>
                  {errorMsg}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Post-save analysis modal ── */}
      {showAnalysisModal && (
        <AnalysisModal
          analysisStep={analysisStep}
          showResult={showAnalysisResult}
          orchestratorActions={orchestratorActions}
          latestAlert={latestAlert}
          onCareManager={() => navigate('/guide?auto=care_manager_report')}
          onHome={() => navigate('/home')}
        />
      )}
    </div>
  )
}
