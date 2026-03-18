import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import HistorySidebar from './components/sidebar/HistorySidebar'
import ChatPage from './pages/ChatPage'
import RecordDetailPage from './pages/RecordDetailPage'
import ReportDetailPage from './pages/ReportDetailPage'
import { useChat } from './hooks/useChat'
import { useHistory } from './hooks/useHistory'
import type { CareRecord, AlertNotification, Report, Document } from './types'

// ── AppLayout ─────────────────────────────────────────────────────────────────
// Rendered inside BrowserRouter so useNavigate is available.

function AppLayout() {
  const navigate = useNavigate()

  // Chat state — lifted to App level so sidebar's "New Chat" can clear messages
  const { messages, isLoading, isStreaming, sendMessage, clearMessages } = useChat()

  // History data for sidebar
  const { records, alerts, reports, documents } = useHistory()

  function handleRecordClick(record: CareRecord) {
    navigate(`/record/${record.id}`)
  }

  function handleAlertClick(_alert: AlertNotification) {
    // Navigate home so user can see the chat and address the alert
    navigate('/')
  }

  function handleReportClick(report: Report) {
    navigate(`/report/${report.id}`, { state: { report } })
  }

  function handleDocumentClick(_doc: Document) {
    navigate('/')
  }

  function handleNewChat() {
    clearMessages()
    navigate('/')
  }

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg)' }}>
      {/* ── Left: History sidebar ── */}
      <HistorySidebar
        records={records}
        alerts={alerts}
        reports={reports}
        documents={documents}
        onRecordClick={handleRecordClick}
        onAlertClick={handleAlertClick}
        onReportClick={handleReportClick}
        onDocumentClick={handleDocumentClick}
        onNewChat={handleNewChat}
      />

      {/* ── Right: Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Routes>
          <Route
            path="/"
            element={
              <ChatPage
                messages={messages}
                isLoading={isLoading}
                isStreaming={isStreaming}
                sendMessage={sendMessage}
              />
            }
          />
          <Route path="/record/:id" element={<RecordDetailPage />} />
          <Route path="/report/:id" element={<ReportDetailPage />} />
        </Routes>
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}
