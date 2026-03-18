import { useState } from 'react'
import {
  Plus, Bell, FileText, Activity,
  ChevronDown, ChevronRight,
  FileBarChart, FolderOpen,
  Stethoscope, ArrowRightLeft, CheckSquare, Shield,
} from 'lucide-react'
import type { CareRecord, AlertNotification, Report, Document } from '../../types'
import AlertPanel from './AlertPanel'

export interface HistorySidebarProps {
  records: CareRecord[]
  alerts: AlertNotification[]
  reports: Report[]
  documents: Document[]
  onRecordClick: (record: CareRecord) => void
  onAlertClick: (alert: AlertNotification) => void
  onReportClick: (report: Report) => void
  onDocumentClick: (doc: Document) => void
  onNewChat: () => void
}

function formatRecordDate(dateStr: string): string {
  const [, m, day] = dateStr.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(m) - 1]} ${parseInt(day)}`
}

function formatReportPeriod(periodStart: string): string {
  const [year, month] = periodStart.split('-')
  return `${year}年${parseInt(month)}月`
}

const DOC_TYPE_ICON: Record<Document['type'], React.ElementType> = {
  doctor_memo: Stethoscope,
  handover: ArrowRightLeft,
  checklist: CheckSquare,
  insurance_form: Shield,
}

const DOC_TYPE_LABEL: Record<Document['type'], string> = {
  doctor_memo: '診察メモ',
  handover: '引き継ぎ',
  checklist: 'チェックリスト',
  insurance_form: '保険書類',
}

export default function HistorySidebar({
  records,
  alerts,
  reports,
  documents,
  onRecordClick,
  onAlertClick,
  onReportClick,
  onDocumentClick,
  onNewChat,
}: HistorySidebarProps) {
  const [alertsOpen, setAlertsOpen] = useState(true)
  const [reportsOpen, setReportsOpen] = useState(true)
  const [documentsOpen, setDocumentsOpen] = useState(true)
  const unreadCount = alerts.filter((a) => !a.read).length

  // Sort most recent first
  const sortedRecords = [...records].sort(
    (a, b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime()
  )
  const sortedReports = [...reports].sort(
    (a, b) => new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime()
  )
  const sortedDocuments = [...documents].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return (
    <aside
      className="flex flex-col flex-shrink-0 h-full overflow-hidden"
      style={{
        width: 280,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* ── Logo ─────────────────────────────────────────────── */}
      <div
        className="flex flex-col px-5 pt-5 pb-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span
          className="font-bold text-lg leading-tight"
          style={{ color: 'var(--primary)', letterSpacing: '-0.01em' }}
        >
          MimamoAI
        </span>
        <span className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
          AI Assistant for Caregivers
        </span>
      </div>

      {/* ── New Chat button ───────────────────────────────────── */}
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={onNewChat}
          className="flex items-center justify-center gap-2 w-full rounded-xl text-sm font-semibold transition-all duration-150"
          style={{
            padding: '10px 16px',
            backgroundColor: 'var(--primary)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLButtonElement
            el.style.backgroundColor = 'var(--primary-hover)'
            el.style.transform = 'translateY(-1px)'
            el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLButtonElement
            el.style.backgroundColor = 'var(--primary)'
            el.style.transform = 'translateY(0)'
            el.style.boxShadow = 'none'
          }}
        >
          <Plus size={16} />
          New Chat
        </button>
      </div>

      {/* ── Scrollable body ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '12px 0' }}>

        {/* Alerts section */}
        <section style={{ marginBottom: 8 }}>
          <button
            onClick={() => setAlertsOpen((prev) => !prev)}
            className="flex items-center gap-2 w-full text-left"
            style={{
              padding: '6px 16px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Bell size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <span
              className="text-xs font-semibold flex-1"
              style={{ color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}
            >
              Alerts
            </span>
            {unreadCount > 0 && (
              <span
                className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: 'var(--danger-light)',
                  color: 'var(--danger)',
                  minWidth: 18,
                  textAlign: 'center',
                }}
              >
                {unreadCount}
              </span>
            )}
            {alertsOpen
              ? <ChevronDown size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              : <ChevronRight size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            }
          </button>

          {alertsOpen && (
            <div style={{ paddingLeft: 4, paddingRight: 4 }}>
              {alerts.length > 0 ? (
                alerts.map((alert) => (
                  <AlertPanel key={alert.id} alert={alert} onClick={onAlertClick} />
                ))
              ) : (
                <p
                  className="text-xs text-center py-3"
                  style={{ color: 'var(--text-tertiary)', padding: '12px 16px' }}
                >
                  No alerts
                </p>
              )}
            </div>
          )}
        </section>

        {/* Divider */}
        <div style={{ height: 1, backgroundColor: 'var(--border)', margin: '4px 16px 12px' }} />

        {/* Records section */}
        <section style={{ marginBottom: 8 }}>
          <div className="flex items-center gap-2" style={{ padding: '6px 16px 8px' }}>
            <FileText size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <span
              className="text-xs font-semibold"
              style={{ color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}
            >
              記録履歴
            </span>
          </div>

          <div style={{ paddingLeft: 4, paddingRight: 4 }}>
            {sortedRecords.length > 0 ? (
              sortedRecords.map((rec) => (
                <button
                  key={rec.id}
                  onClick={() => onRecordClick(rec)}
                  className="flex items-start gap-2.5 w-full text-left"
                  style={{
                    padding: '9px 12px',
                    borderRadius: 10,
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface-alt)'
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
                  }}
                >
                  {/* Date badge */}
                  <span
                    className="text-xs font-medium flex-shrink-0 px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: 'var(--primary-light)',
                      color: 'var(--primary)',
                      marginTop: 1,
                    }}
                  >
                    {formatRecordDate(rec.recordDate)}
                  </span>
                  {/* Summary */}
                  <span
                    className="text-xs"
                    style={{
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      lineHeight: 1.4,
                    }}
                  >
                    {rec.rawInput.slice(0, 30)}{rec.rawInput.length > 30 ? '…' : ''}
                  </span>
                </button>
              ))
            ) : (
              <p
                className="text-xs text-center"
                style={{ color: 'var(--text-tertiary)', padding: '12px 16px' }}
              >
                No records yet
              </p>
            )}
          </div>
        </section>

        {/* Divider */}
        <div style={{ height: 1, backgroundColor: 'var(--border)', margin: '4px 16px 12px' }} />

        {/* Reports section */}
        <section style={{ marginBottom: 8 }}>
          <button
            onClick={() => setReportsOpen((prev) => !prev)}
            className="flex items-center gap-2 w-full text-left"
            style={{
              padding: '6px 16px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <FileBarChart size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <span
              className="text-xs font-semibold flex-1"
              style={{ color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}
            >
              レポート
            </span>
            {reportsOpen
              ? <ChevronDown size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              : <ChevronRight size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            }
          </button>

          {reportsOpen && (
            <div style={{ paddingLeft: 4, paddingRight: 4 }}>
              {sortedReports.length > 0 ? (
                sortedReports.map((report) => (
                  <button
                    key={report.id}
                    onClick={() => onReportClick(report)}
                    className="flex items-start gap-2.5 w-full text-left"
                    style={{
                      padding: '9px 12px',
                      borderRadius: 10,
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface-alt)'
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
                    }}
                  >
                    {/* Period badge */}
                    <span
                      className="text-xs font-medium flex-shrink-0 px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: 'var(--accent-light)',
                        color: 'var(--accent)',
                        marginTop: 1,
                      }}
                    >
                      {formatReportPeriod(report.periodStart)}
                    </span>
                    {/* Template type */}
                    <span
                      className="text-xs"
                      style={{
                        color: 'var(--text-secondary)',
                        lineHeight: 1.4,
                      }}
                    >
                      {report.templateType === 'standard' ? '標準レポート' : '簡易レポート'}
                    </span>
                  </button>
                ))
              ) : (
                <p
                  className="text-xs text-center"
                  style={{ color: 'var(--text-tertiary)', padding: '12px 16px' }}
                >
                  レポートなし
                </p>
              )}
            </div>
          )}
        </section>

        {/* Divider */}
        <div style={{ height: 1, backgroundColor: 'var(--border)', margin: '4px 16px 12px' }} />

        {/* Documents section */}
        <section>
          <button
            onClick={() => setDocumentsOpen((prev) => !prev)}
            className="flex items-center gap-2 w-full text-left"
            style={{
              padding: '6px 16px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <FolderOpen size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <span
              className="text-xs font-semibold flex-1"
              style={{ color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}
            >
              作成書類
            </span>
            {documentsOpen
              ? <ChevronDown size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              : <ChevronRight size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            }
          </button>

          {documentsOpen && (
            <div style={{ paddingLeft: 4, paddingRight: 4 }}>
              {sortedDocuments.length > 0 ? (
                sortedDocuments.map((doc) => {
                  const Icon = DOC_TYPE_ICON[doc.type]
                  return (
                    <button
                      key={doc.id}
                      onClick={() => onDocumentClick(doc)}
                      className="flex items-start gap-2.5 w-full text-left"
                      style={{
                        padding: '9px 12px',
                        borderRadius: 10,
                        border: 'none',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface-alt)'
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
                      }}
                    >
                      {/* Type icon badge */}
                      <span
                        className="flex items-center justify-center flex-shrink-0 rounded-full"
                        style={{
                          width: 22,
                          height: 22,
                          backgroundColor: 'var(--primary-light)',
                          marginTop: 1,
                        }}
                      >
                        <Icon size={11} style={{ color: 'var(--primary)' }} />
                      </span>
                      {/* Title + type label */}
                      <span className="flex flex-col min-w-0">
                        <span
                          className="text-xs font-medium"
                          style={{
                            color: 'var(--text)',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {doc.title}
                        </span>
                        <span
                          className="text-xs"
                          style={{ color: 'var(--text-tertiary)', lineHeight: 1.4 }}
                        >
                          {DOC_TYPE_LABEL[doc.type]}
                        </span>
                      </span>
                    </button>
                  )
                })
              ) : (
                <p
                  className="text-xs text-center"
                  style={{ color: 'var(--text-tertiary)', padding: '12px 16px' }}
                >
                  書類なし
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      {/* ── Agent Status ─────────────────────────────────────── */}
      <div className="px-4 py-4" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <span
            className="block rounded-full flex-shrink-0"
            style={{
              width: 7,
              height: 7,
              backgroundColor: '#22c55e',
              boxShadow: '0 0 0 2px rgba(34,197,94,0.25)',
            }}
          />
          <Activity size={11} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            Agent Active
          </span>
        </div>
      </div>
    </aside>
  )
}
