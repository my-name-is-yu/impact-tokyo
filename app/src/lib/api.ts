const API_BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(error.error || error.message || 'API error')
  }
  return res.json()
}

export async function structureRecord(rawText: string, imagesBase64: string[] = []) {
  return request<{ id: string; structuredData: import('../types').StructuredData }>(
    '/records/structure',
    {
      method: 'POST',
      body: JSON.stringify({ raw_text: rawText, images_base64: imagesBase64, care_recipient_id: 'demo-recipient-1' }),
    }
  )
}

export async function saveRecord(recordId: string) {
  return request<import('../types').CareRecord>(`/records/${recordId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'saved' }),
  })
}

export async function getRecords() {
  return request<import('../types').CareRecord[]>('/records')
}

export async function sendGuideMessage(sessionId: string | null, userMessage: string, prefecture: string = 'Tokyo') {
  const res = await fetch(`${API_BASE}/guide/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, user_message: userMessage, prefecture }),
  })
  if (!res.ok) throw new Error('Guide API error')
  return res
}

export async function generateReport(periodStart: string, periodEnd: string, additionalNotes: string = '', templateType: string = 'standard') {
  return request<import('../types').Report>('/reports/generate', {
    method: 'POST',
    body: JSON.stringify({
      care_recipient_id: 'demo-recipient-1',
      period_start: periodStart,
      period_end: periodEnd,
      template_type: templateType,
      additional_notes: additionalNotes,
    }),
  })
}

export async function getAlerts() {
  return request<import('../types').AlertNotification[]>('/alerts')
}

export async function generateAlertMessage(alertId: string) {
  return request<{ subject: string; body: string; consultation_points: string }>(
    `/alerts/${alertId}/generate-message`,
    { method: 'POST' }
  )
}

export async function analyzeRecord(recordId: string) {
  return request<{ detected: boolean; pattern?: string; severity?: string; suggestion?: string }>(
    `/records/${recordId}/analyze`,
    { method: 'POST' }
  )
}

export async function generateDoctorMemo(visitReason?: string) {
  return request<{ memo: string }>('/records/doctor-memo', {
    method: 'POST',
    body: JSON.stringify({ care_recipient_id: 'demo-recipient-1', visit_reason: visitReason }),
  })
}

export async function generateHandover(providerName?: string, days?: number) {
  return request<{ summary: string }>('/records/handover', {
    method: 'POST',
    body: JSON.stringify({ care_recipient_id: 'demo-recipient-1', provider_name: providerName, days: days || 3 }),
  })
}

export async function generateChecklist(type: 'admission' | 'discharge') {
  return request<{ checklist: { category: string; items: { text: string; done: boolean }[] }[] }>('/guide/checklist', {
    method: 'POST',
    body: JSON.stringify({ type, care_recipient_id: 'demo-recipient-1' }),
  })
}

export async function getReports() {
  return request<import('../types').Report[]>('/reports')
}

export async function getDocuments() {
  return request<import('../types').Document[]>('/documents')
}

export async function getN8nStatus() {
  return request<{ connected: boolean; webhook_url: string }>('/n8n/status')
}

export async function runOrchestrator() {
  return request<{ actions: string[]; timestamp?: string }>('/orchestrator/run', {
    method: 'POST',
  })
}

export async function getOrchestratorStatus() {
  return request<{ actions: string[]; timestamp: string | null }>('/orchestrator/status')
}
