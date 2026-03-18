import { useState, useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Activity,
  Bell,
  FileText,
  PenLine,
  MessageCircle,
  ClipboardList,
  Stethoscope,
  UserCheck,
  ListChecks,
  Copy,
  X,
} from 'lucide-react'
import type { AlertNotification, CareRecord } from '../types'
import { generateDoctorMemo, generateHandover, generateChecklist, getAlerts, getRecords, getOrchestratorStatus } from '../lib/api'

// ── Styles ────────────────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0,0,0,0.3)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
  animation: 'fadeIn 0.15s ease',
}

const modalCardStyle: React.CSSProperties = {
  backgroundColor: 'var(--surface)',
  borderRadius: 20,
  padding: 32,
  boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  width: '100%',
  maxWidth: 480,
  maxHeight: '80vh',
  overflowY: 'auto',
  margin: '0 16px',
  animation: 'fadeIn 0.15s ease',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  fontSize: 14,
  color: 'var(--text)',
  backgroundColor: 'var(--surface)',
  outline: 'none',
  boxSizing: 'border-box',
}

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '10px 20px',
  borderRadius: 10,
  backgroundColor: 'var(--primary)',
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  border: 'none',
  cursor: 'pointer',
}

const secondaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '10px 16px',
  borderRadius: 10,
  backgroundColor: 'var(--surface)',
  color: 'var(--text-secondary)',
  fontSize: 14,
  fontWeight: 500,
  border: '1px solid var(--border)',
  cursor: 'pointer',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return `${weekdays[d.getDay()]}, ${d.toLocaleString('en-US', { month: 'long' })} ${d.getDate()}, ${d.getFullYear()}`
}

function formatRecordDate(dateStr: string): string {
  const [, m, day] = dateStr.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(m) - 1]} ${parseInt(day)}`
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {
    // silent fallback
  })
}

// ── Mini Chart ────────────────────────────────────────────────────────────────

const mealBars = [
  { label: '3/5', pct: 60 },
  { label: '3/6', pct: 20 },
  { label: '3/7', pct: 10 },
]

function MealMiniChart() {
  return (
    <div style={{ marginTop: 10, marginBottom: 12 }}>
      <p style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6 }}>
        Meal intake (last 3 days)
      </p>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 44 }}>
        {mealBars.map(({ label, pct }) => {
          const color = pct > 50 ? 'var(--primary)' : pct >= 20 ? 'var(--warning)' : 'var(--danger)'
          return (
            <div
              key={label}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}
            >
              <div style={{ width: '100%', height: 32, display: 'flex', alignItems: 'flex-end' }}>
                <div
                  style={{
                    width: '100%',
                    height: `${Math.max(pct, 8)}%`,
                    backgroundColor: color,
                    borderRadius: 3,
                    opacity: 0.8,
                  }}
                />
              </div>
              <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Alert helpers ─────────────────────────────────────────────────────────────

function borderColor(severity: AlertNotification['severity']): string {
  switch (severity) {
    case 'high': return 'var(--danger)'
    case 'medium': return 'var(--warning)'
    default: return '#3B82F6'
  }
}

function severityLabel(severity: AlertNotification['severity']): { text: string; color: string; bg: string } {
  switch (severity) {
    case 'high': return { text: 'Urgent', color: 'var(--danger)', bg: 'var(--danger-light)' }
    case 'medium': return { text: 'Caution', color: 'var(--warning)', bg: 'var(--warning-light)' }
    default: return { text: 'Info', color: '#3B82F6', bg: '#EFF6FF' }
  }
}

function AlertCard({ alert, onDismiss }: { alert: AlertNotification; onDismiss: (id: string) => void }) {
  const leftBorder = borderColor(alert.severity)
  const label = severityLabel(alert.severity)
  const isHealthAlert = alert.type === 'health_alert'
  const actionUrl = isHealthAlert ? '/guide?auto=care_manager_report' : alert.actionUrl

  return (
    <div
      style={{
        backgroundColor: 'var(--surface)',
        borderRadius: 16,
        borderLeft: `4px solid ${leftBorder}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)',
        padding: 20,
        marginBottom: 12,
        transition: 'box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)'
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: label.bg, color: label.color }}
        >
          {label.text}
        </span>
        <span className="text-sm font-medium" style={{ color: 'var(--text)', letterSpacing: '-0.01em' }}>
          {alert.title}
        </span>
      </div>
      <p className="text-sm leading-relaxed mb-1" style={{ color: 'var(--text-secondary)' }}>
        {alert.description}
      </p>
      {isHealthAlert && <MealMiniChart />}
      <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
        {alert.suggestion}
      </p>
      <div className="flex items-center gap-3">
        {actionUrl && (
          <Link
            to={actionUrl}
            className="text-sm font-medium transition-colors duration-150"
            style={{ color: 'var(--primary)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--primary-hover)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--primary)' }}
          >
            View details
          </Link>
        )}
        <button
          onClick={() => onDismiss(alert.id)}
          className="text-sm transition-colors duration-150"
          style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)' }}
        >
          Later
        </button>
      </div>
    </div>
  )
}

// ── Agent Activity Log ────────────────────────────────────────────────────────

type AgentLogSeverity = 'high' | 'normal-green' | 'normal-blue' | 'normal-gray'

interface AgentLogEntry {
  time: string
  icon: ReactNode
  agentName: string
  action: string
  severity: AgentLogSeverity
}

const agentActivityLog: AgentLogEntry[] = [
  {
    time: '09:01',
    icon: <AlertTriangle size={13} />,
    agentName: 'Anomaly Detection Agent',
    action: 'Detected decreased appetite pattern → Recommended care manager report',
    severity: 'high',
  },
  {
    time: '09:00',
    icon: <Activity size={13} />,
    agentName: 'Record Analysis Agent',
    action: 'Analyzed records from Mar 5–7',
    severity: 'normal-green',
  },
  {
    time: '08:00',
    icon: <FileText size={13} />,
    agentName: 'Report Agent',
    action: 'Created February monthly report draft',
    severity: 'normal-blue',
  },
  {
    time: 'Yesterday',
    icon: <Bell size={13} />,
    agentName: 'Reminder Agent',
    action: 'Sent record entry reminder',
    severity: 'normal-gray',
  },
]

const agentIconColor: Record<AgentLogSeverity, string> = {
  high: 'var(--danger)',
  'normal-green': 'var(--primary)',
  'normal-blue': '#3B82F6',
  'normal-gray': 'var(--text-tertiary)',
}

function AgentActivityLog({ actions }: { actions: string[] }) {
  const actionConfigs: Record<string, { icon: ReactNode; agentName: string; actionText: string; severity: AgentLogSeverity }> = {
    'analyze_health_pattern': { icon: <Activity size={13} />, agentName: 'Health Analysis Agent', actionText: 'Analyzed health patterns in recent records', severity: 'normal-green' },
    'create_alert': { icon: <AlertTriangle size={13} />, agentName: 'Alert Agent', actionText: 'Created proactive alert for caregiver', severity: 'high' },
    'draft_care_manager_message': { icon: <Bell size={13} />, agentName: 'Communication Agent', actionText: 'Drafted care manager notification', severity: 'normal-blue' },
    'suggest_report_generation': { icon: <FileText size={13} />, agentName: 'Report Agent', actionText: 'Suggested monthly report generation', severity: 'normal-blue' },
  }

  const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

  const actionEntries: AgentLogEntry[] = actions.length > 0
    ? actions.map((action) => {
        const config = actionConfigs[action] || {
          icon: <Activity size={13} />,
          agentName: 'Orchestrator',
          actionText: action,
          severity: 'normal-gray' as AgentLogSeverity,
        }
        return { time: now, icon: config.icon, agentName: config.agentName, action: config.actionText, severity: config.severity }
      })
    : agentActivityLog

  return (
    <section style={{ marginBottom: 32 }}>
      <h2
        className="text-sm font-semibold mb-3"
        style={{ color: 'var(--text-secondary)', letterSpacing: '-0.01em' }}
      >
        AI Agent Activity Log
      </h2>
      <div
        style={{
          backgroundColor: 'var(--surface)',
          borderRadius: 16,
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          display: 'flex',
          flexWrap: 'wrap',
          overflow: 'hidden',
        }}
      >
        {actionEntries.map((entry, i) => (
          <div
            key={i}
            style={{
              flex: '1 1 220px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '14px 18px',
              borderRight: i < actionEntries.length - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            <span style={{ color: agentIconColor[entry.severity], flexShrink: 0, marginTop: 1 }}>
              {entry.icon}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex items-center gap-2 mb-0.5">
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                  {entry.time}
                </span>
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>
                  {entry.agentName}
                </span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                {entry.action}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Doctor Memo Modal ─────────────────────────────────────────────────────────

function DoctorMemoModal({ onClose }: { onClose: () => void }) {
  const [visitReason, setVisitReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const data = await generateDoctorMemo(visitReason || undefined)
      setResult(data.memo)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  function handleCopy() {
    if (result) {
      copyToClipboard(result)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modalCardStyle}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Stethoscope size={18} color="var(--primary)" />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text)', letterSpacing: '-0.01em' }}>
              Create Doctor Visit Memo
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {!result && !loading && (
          <>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Reason for visit (optional)
            </label>
            <input
              type="text"
              value={visitReason}
              onChange={(e) => setVisitReason(e.target.value)}
              placeholder="e.g. Regular checkup, concerns about decreased appetite"
              style={inputStyle}
            />
            {error && (
              <p className="text-sm mt-3" style={{ color: 'var(--danger)' }}>{error}</p>
            )}
            <div className="flex justify-end mt-5">
              <button style={primaryBtnStyle} onClick={handleGenerate}>
                Generate
              </button>
            </div>
          </>
        )}

        {loading && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>
            AI is analyzing records and creating the memo...
          </p>
        )}

        {result && (
          <>
            <div
              style={{
                backgroundColor: 'var(--surface-alt, #F8F8F8)',
                borderRadius: 12,
                padding: 16,
                fontSize: 13,
                lineHeight: 1.8,
                color: 'var(--text)',
                whiteSpace: 'pre-wrap',
                border: '1px solid var(--border)',
                marginBottom: 16,
              }}
            >
              {result}
            </div>
            <div className="flex gap-2 justify-end">
              <button style={secondaryBtnStyle} onClick={handleCopy}>
                <Copy size={14} />
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button style={secondaryBtnStyle} onClick={onClose}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Handover Modal ────────────────────────────────────────────────────────────

function HandoverModal({ onClose }: { onClose: () => void }) {
  const [recipient, setRecipient] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const data = await generateHandover(recipient || undefined)
      setResult(data.summary)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  function handleCopy() {
    if (result) {
      copyToClipboard(result)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modalCardStyle}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <UserCheck size={18} color="var(--primary)" />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text)', letterSpacing: '-0.01em' }}>
              Create Handover Summary
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {!result && !loading && (
          <>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Handover recipient (optional)
            </label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="e.g. Home care helper, Day service"
              style={inputStyle}
            />
            {error && (
              <p className="text-sm mt-3" style={{ color: 'var(--danger)' }}>{error}</p>
            )}
            <div className="flex justify-end mt-5">
              <button style={primaryBtnStyle} onClick={handleGenerate}>
                Generate
              </button>
            </div>
          </>
        )}

        {loading && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>
            AI is analyzing records and creating the handover summary...
          </p>
        )}

        {result && (
          <>
            <div
              style={{
                backgroundColor: 'var(--surface-alt, #F8F8F8)',
                borderRadius: 12,
                padding: 16,
                fontSize: 13,
                lineHeight: 1.8,
                color: 'var(--text)',
                whiteSpace: 'pre-wrap',
                border: '1px solid var(--border)',
                marginBottom: 16,
              }}
            >
              {result}
            </div>
            <div className="flex gap-2 justify-end">
              <button style={secondaryBtnStyle} onClick={handleCopy}>
                <Copy size={14} />
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button style={secondaryBtnStyle} onClick={onClose}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Checklist Modal ───────────────────────────────────────────────────────────

interface ChecklistCategory {
  category: string
  items: { text: string; done: boolean }[]
}

function ChecklistModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'admission' | 'discharge'>('admission')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ChecklistCategory[] | null>(null)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    setResult(null)
    setChecked({})
    try {
      const data = await generateChecklist(tab)
      setResult(data.checklist)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  function toggleItem(key: string) {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function handleCopy() {
    if (result) {
      const text = result
        .map((cat) => `【${cat.category}】\n${cat.items.map((item) => `□ ${item.text}`).join('\n')}`)
        .join('\n\n')
      copyToClipboard(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '8px 0',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s',
    backgroundColor: active ? 'var(--primary)' : 'transparent',
    color: active ? '#fff' : 'var(--text-secondary)',
  })

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modalCardStyle}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <ListChecks size={18} color="var(--primary)" />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text)', letterSpacing: '-0.01em' }}>
              Hospital Admission/Discharge Checklist
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab toggle */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            backgroundColor: 'var(--surface-alt, #F3F4F6)',
            borderRadius: 10,
            padding: 4,
            marginBottom: 20,
          }}
        >
          <button style={tabBtnStyle(tab === 'admission')} onClick={() => { setTab('admission'); setResult(null) }}>
            Admission
          </button>
          <button style={tabBtnStyle(tab === 'discharge')} onClick={() => { setTab('discharge'); setResult(null) }}>
            Discharge
          </button>
        </div>

        {!result && !loading && (
          <>
            {error && (
              <p className="text-sm mb-3" style={{ color: 'var(--danger)' }}>{error}</p>
            )}
            <div className="flex justify-end">
              <button style={primaryBtnStyle} onClick={handleGenerate}>
                Generate
              </button>
            </div>
          </>
        )}

        {loading && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>
            AI is creating the checklist...
          </p>
        )}

        {result && (
          <>
            <div style={{ marginBottom: 16 }}>
              {result.map((cat) => (
                <div key={cat.category} style={{ marginBottom: 16 }}>
                  <p
                    className="text-xs font-semibold mb-2"
                    style={{
                      color: 'var(--primary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {cat.category}
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {cat.items.map((item) => {
                      const key = `${cat.category}::${item.text}`
                      const isChecked = !!checked[key]
                      return (
                        <li key={key}>
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 10,
                              cursor: 'pointer',
                              fontSize: 13,
                              color: isChecked ? 'var(--text-tertiary)' : 'var(--text)',
                              textDecoration: isChecked ? 'line-through' : 'none',
                              lineHeight: 1.5,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleItem(key)}
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
            <div className="flex gap-2 justify-end">
              <button style={secondaryBtnStyle} onClick={handleCopy}>
                <Copy size={14} />
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button style={secondaryBtnStyle} onClick={onClose}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Secondary Quick Action Button ─────────────────────────────────────────────

function SecondaryActionBtn({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-2 text-sm font-medium rounded-xl transition-all duration-150 w-full"
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        color: 'var(--text-secondary)',
        padding: '12px 16px',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.transform = 'translateY(-1px)'
        el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.transform = 'translateY(0)'
        el.style.boxShadow = 'none'
      }}
    >
      {icon}
      {label}
    </button>
  )
}

// ── HomePage ──────────────────────────────────────────────────────────────────

type ModalType = 'doctorMemo' | 'handover' | 'checklist' | null

export default function HomePage() {
  const [alerts, setAlerts] = useState<AlertNotification[]>([])
  const [records, setRecords] = useState<CareRecord[]>([])
  const [openModal, setOpenModal] = useState<ModalType>(null)
  const [orchestratorActions, setOrchestratorActions] = useState<string[]>([])
  const today = new Date()

  // Fetch alerts from API
  useEffect(() => {
    getAlerts().then(setAlerts).catch(() => {})
  }, [])

  // Fetch records from API
  useEffect(() => {
    getRecords().then((recs) => setRecords(recs.slice(0, 3))).catch(() => {})
  }, [])

  // Fetch orchestrator status
  useEffect(() => {
    getOrchestratorStatus()
      .then((status) => {
        if (status.actions) setOrchestratorActions(status.actions)
      })
      .catch(() => {})
  }, [])

  function dismissAlert(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <div style={{ padding: '32px 48px', maxWidth: 1200, margin: '0 auto' }}>

      {/* Modals */}
      {openModal === 'doctorMemo' && <DoctorMemoModal onClose={() => setOpenModal(null)} />}
      {openModal === 'handover' && <HandoverModal onClose={() => setOpenModal(null)} />}
      {openModal === 'checklist' && <ChecklistModal onClose={() => setOpenModal(null)} />}

      {/* Welcome */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1
            className="text-2xl font-semibold mb-1"
            style={{ color: 'var(--text)', letterSpacing: '-0.01em' }}
          >
            Welcome back, <span style={{ color: 'var(--primary)' }}>Yu</span>
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Today's care status
          </p>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          {formatDate(today)}
        </p>
      </div>

      {/* Main grid: 2fr left + 1fr right */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 24,
          marginBottom: 32,
          alignItems: 'start',
        }}
      >
        {/* Left: AI Insights */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2
              className="text-sm font-semibold"
              style={{ color: 'var(--text-secondary)', letterSpacing: '-0.01em' }}
            >
              AI Insights
            </h2>
            {alerts.length > 0 && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}
              >
                {alerts.length}
              </span>
            )}
          </div>
          {alerts.length > 0 ? (
            alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} onDismiss={dismissAlert} />
            ))
          ) : (
            <div
              style={{
                backgroundColor: 'var(--surface)',
                borderRadius: 16,
                padding: 24,
                border: '1px solid var(--border)',
                color: 'var(--text-tertiary)',
                fontSize: 14,
                textAlign: 'center',
              }}
            >
              No AI notifications at this time
            </div>
          )}
        </div>

        {/* Right: Weekly Summary + Quick Actions */}
        <div className="flex flex-col gap-4">

          {/* Weekly Summary */}
          <div
            style={{
              backgroundColor: 'var(--surface)',
              borderRadius: 16,
              padding: 24,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)',
              border: '1px solid var(--border)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-sm font-semibold"
                style={{ color: 'var(--text-secondary)', letterSpacing: '-0.01em' }}
              >
                This Week's Records
              </h2>
              <span
                className="text-xs font-medium px-3 py-1 rounded-full"
                style={{ backgroundColor: 'var(--warning-light)', color: 'var(--warning)' }}
              >
                Caution
              </span>
            </div>
            <p
              className="text-2xl font-semibold mb-1"
              style={{ color: 'var(--primary)', letterSpacing: '-0.02em' }}
            >
              3 days
              <span className="text-base font-normal ml-1" style={{ color: 'var(--text-tertiary)' }}>
                / 7 days
              </span>
            </p>
            <div
              className="w-full rounded-full mb-2"
              style={{ height: 8, backgroundColor: 'var(--surface-alt)' }}
            >
              <div
                className="rounded-full"
                style={{
                  height: 8,
                  width: `${(3 / 7) * 100}%`,
                  backgroundColor: 'var(--primary)',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              4 more days of records needed this week
            </p>
          </div>

          {/* Quick Actions */}
          <div
            style={{
              backgroundColor: 'var(--surface)',
              borderRadius: 16,
              padding: 24,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)',
              border: '1px solid var(--border)',
            }}
          >
            <h2
              className="text-sm font-semibold mb-3"
              style={{ color: 'var(--text-secondary)', letterSpacing: '-0.01em' }}
            >
              Quick Actions
            </h2>

            {/* Primary action: full width */}
            <Link
              to="/record/new"
              className="flex items-center justify-center gap-2 text-sm font-semibold text-white rounded-xl transition-all duration-150 mb-3"
              style={{
                backgroundColor: 'var(--primary)',
                padding: '12px 16px',
                textDecoration: 'none',
                display: 'flex',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLAnchorElement
                el.style.backgroundColor = 'var(--primary-hover)'
                el.style.transform = 'translateY(-1px)'
                el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLAnchorElement
                el.style.backgroundColor = 'var(--primary)'
                el.style.transform = 'translateY(0)'
                el.style.boxShadow = 'none'
              }}
            >
              <PenLine size={16} />
              Enter a Record
            </Link>

            {/* 2×2 grid for secondary actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Link
                to="/guide"
                className="flex items-center justify-center gap-2 text-sm font-medium rounded-xl transition-all duration-150"
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  padding: '12px 10px',
                  textDecoration: 'none',
                  textAlign: 'center',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLAnchorElement
                  el.style.transform = 'translateY(-1px)'
                  el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLAnchorElement
                  el.style.transform = 'translateY(0)'
                  el.style.boxShadow = 'none'
                }}
              >
                <MessageCircle size={15} />
                Look Up Procedures
              </Link>

              <Link
                to="/report/new"
                className="flex items-center justify-center gap-2 text-sm font-medium rounded-xl transition-all duration-150"
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  padding: '12px 10px',
                  textDecoration: 'none',
                  textAlign: 'center',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLAnchorElement
                  el.style.transform = 'translateY(-1px)'
                  el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLAnchorElement
                  el.style.transform = 'translateY(0)'
                  el.style.boxShadow = 'none'
                }}
              >
                <ClipboardList size={15} />
                Create a Report
              </Link>

              <SecondaryActionBtn
                icon={<Stethoscope size={15} />}
                label="Create Doctor Visit Memo"
                onClick={() => setOpenModal('doctorMemo')}
              />

              <SecondaryActionBtn
                icon={<UserCheck size={15} />}
                label="Create Handover Summary"
                onClick={() => setOpenModal('handover')}
              />

              <div style={{ gridColumn: '1 / -1' }}>
                <SecondaryActionBtn
                  icon={<ListChecks size={15} />}
                  label="Admission/Discharge Checklist"
                  onClick={() => setOpenModal('checklist')}
                />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Agent Activity Log */}
      <AgentActivityLog actions={orchestratorActions} />

      {/* Recent Records */}
      <section>
        <h2
          className="text-sm font-semibold mb-3"
          style={{ color: 'var(--text-secondary)', letterSpacing: '-0.01em' }}
        >
          Recent Records
        </h2>
        {records.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {records.map((rec) => (
              <div
                key={rec.id}
                style={{
                  backgroundColor: 'var(--surface)',
                  borderRadius: 16,
                  padding: 20,
                  border: '1px solid var(--border)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'box-shadow 0.2s, transform 0.2s',
                  cursor: 'default',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'
                  el.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'
                  el.style.transform = 'translateY(0)'
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{
                      backgroundColor: 'var(--primary-light)',
                      color: 'var(--primary)',
                    }}
                  >
                    {formatRecordDate(rec.recordDate)}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {rec.recordTime}
                  </span>
                </div>
                <p
                  className="text-sm leading-relaxed"
                  style={{
                    color: 'var(--text)',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {rec.rawInput}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              backgroundColor: 'var(--surface)',
              borderRadius: 16,
              padding: 24,
              border: '1px solid var(--border)',
              color: 'var(--text-tertiary)',
              fontSize: 14,
              textAlign: 'center',
            }}
          >
            No records found
          </div>
        )}
      </section>

    </div>
  )
}
