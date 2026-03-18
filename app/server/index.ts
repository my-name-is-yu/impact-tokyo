import express from 'express'
import cors from 'cors'
import Anthropic from '@anthropic-ai/sdk'
import path from 'path'
import { fileURLToPath } from 'url'
import { demoRecords, demoReports, demoDocuments } from './demo-seed.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT ?? 5001
const isProduction = process.env.NODE_ENV === 'production'
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || ''

app.use(cors({ origin: isProduction ? false : 'http://localhost:5173' }))
app.use(express.json({ limit: '10mb' }))

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── In-Memory Store ───────────────────────────────────────────────────────────

interface StructuredData {
  meal: { breakfast: string; lunch: string; dinner: string; hydration: string }
  elimination: { urine_count: number | null; stool: string }
  sleep: { hours: number | null; quality: string }
  medication: { taken: boolean | null; notes: string }
  physical: { temperature: number | null; pain: string; edema: string; other: string }
  mental: { mood: string; cognition: string; behavior: string }
  fall_risk: string
  special_notes: string
  care_given: string[]
}

interface CareRecord {
  id: string
  userId: string
  careRecipientId: string
  recordDate: string
  recordTime: string
  rawInput: string
  structuredData: StructuredData
  photos: string[]
  status: 'draft' | 'saved'
  createdAt: Date
  updatedAt: Date
}

interface CareReport {
  id: string
  careRecipientId: string
  periodStart: string
  periodEnd: string
  templateType: string
  additionalNotes: string
  overallAssessment: string
  adlSummary: string
  mentalSummary: string
  incidents: string
  handoverNotes: string
  createdAt: Date
}

interface AlertNotification {
  id: string
  userId: string
  careRecipientId: string
  type: string
  title: string
  description: string
  severity: 'high' | 'medium' | 'low'
  suggestion: string
  read: boolean
  actionUrl: string
  createdAt: Date
}

// Seeded demo records
const records: CareRecord[] = [...demoRecords]

const reports: CareReport[] = [...demoReports]

const documents = [...demoDocuments]

const alerts: AlertNotification[] = [
  {
    id: 'alert-1',
    userId: 'demo-user-1',
    careRecipientId: 'demo-recipient-1',
    type: 'health_alert',
    title: 'Appetite has declined for 3 consecutive days',
    description:
      'Appetite has been decreasing since March 5th. There is a risk of dehydration and nutritional deficiency. Reporting to the Care Manager is recommended.',
    severity: 'high',
    suggestion:
      'We recommend reporting the situation to the Care Manager (Hanako Sato). Would you like to draft a message?',
    read: false,
    actionUrl: '/guide',
    createdAt: new Date('2026-03-07T08:00:00'),
  },
  {
    id: 'alert-2',
    userId: 'demo-user-1',
    careRecipientId: 'demo-recipient-1',
    type: 'renewal_reminder',
    title: 'Long-term Care Insurance certification renewal is approaching',
    description:
      "Setsuko Tanaka's Long-term Care Insurance certification expires at the end of April 2026. Let's start preparing for the renewal process.",
    severity: 'medium',
    suggestion: 'Would you like to review the renewal guide? We can help you prepare the required documents.',
    read: false,
    actionUrl: '/guide',
    createdAt: new Date('2026-03-06T09:00:00'),
  },
  {
    id: 'alert-3',
    userId: 'demo-user-1',
    careRecipientId: 'demo-recipient-1',
    type: 'report_ready',
    title: 'Monthly report draft for February has been created',
    description:
      'A draft report for the Care Manager has been created based on care records from February 2026. Please review and edit it.',
    severity: 'low',
    suggestion: 'Would you like to review the report?',
    read: false,
    actionUrl: '/report/new',
    createdAt: new Date('2026-03-01T09:00:00'),
  },
]

// Conversation history per session
const sessionHistories: Record<string, Anthropic.MessageParam[]> = {}

// ─── Orchestrator State ────────────────────────────────────────────────────────

interface CareManagerDraft {
  subject: string
  body: string
  urgency: 'routine' | 'soon' | 'urgent'
  createdAt: Date
}

const careManagerDrafts: CareManagerDraft[] = []

let lastOrchestratorResult: { actions: string[]; timestamp: Date } | null = null

// ─── Orchestrator ──────────────────────────────────────────────────────────────

async function runOrchestrator(record: CareRecord, recentRecords: CareRecord[]): Promise<{ actions: string[] }> {
  const actions: string[] = []

  const tools: Anthropic.Tool[] = [
    {
      name: 'analyze_health_pattern',
      description: 'Analyze recent care records to detect health anomaly patterns (e.g., declining appetite, sleep issues, cognitive changes). Call this when you want to check for concerning trends.',
      input_schema: {
        type: 'object' as const,
        properties: {
          pattern: { type: 'string', description: 'Description of the detected pattern' },
          severity: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Severity level' },
          affected_areas: { type: 'array', items: { type: 'string' }, description: 'Areas affected (e.g., meal, sleep, cognition)' },
        },
        required: ['pattern', 'severity', 'affected_areas'],
      },
    },
    {
      name: 'create_alert',
      description: 'Create a proactive alert notification for the caregiver. Use when a concerning pattern is detected that the caregiver should know about.',
      input_schema: {
        type: 'object' as const,
        properties: {
          title: { type: 'string', description: 'Short alert title' },
          description: { type: 'string', description: 'Detailed explanation of the concern' },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
          suggestion: { type: 'string', description: 'Recommended action for the caregiver' },
        },
        required: ['title', 'description', 'severity', 'suggestion'],
      },
    },
    {
      name: 'draft_care_manager_message',
      description: 'Draft a message to send to the care manager about a health concern. Use when the situation warrants professional attention.',
      input_schema: {
        type: 'object' as const,
        properties: {
          subject: { type: 'string', description: 'Email/message subject line' },
          body: { type: 'string', description: 'Message body text' },
          urgency: { type: 'string', enum: ['routine', 'soon', 'urgent'] },
        },
        required: ['subject', 'body', 'urgency'],
      },
    },
    {
      name: 'suggest_report_generation',
      description: 'Suggest generating a monthly report if sufficient records exist. Use when it is near the end of the month or enough records have accumulated.',
      input_schema: {
        type: 'object' as const,
        properties: {
          reason: { type: 'string', description: 'Why a report should be generated now' },
          record_count: { type: 'number', description: 'Number of records available for the report' },
        },
        required: ['reason', 'record_count'],
      },
    },
  ]

  const systemPrompt = `You are the MimamoAI Orchestrator — an AI agent that proactively monitors care records and takes autonomous actions to support family caregivers.

You have just received a newly saved care record along with recent records from the past 7 days. Your job is to:
1. Analyze the records for any concerning health patterns or trends
2. If you detect an issue, create an alert AND draft a care manager message if the severity is medium or high
3. If enough records have accumulated (5+ in the current month), suggest generating a monthly report

Care recipient: Setsuko Tanaka (Age 78, Care Level 2, mild dementia, hypertension medication)
Care manager: Hanako Sato

Be proactive but not alarmist. Only flag genuinely concerning patterns. Use the tools available to take action.`

  const userMessage = `A new care record has just been saved. Here is the data:

Latest record:
${JSON.stringify(record, null, 2)}

Recent records (past 7 days):
${JSON.stringify(recentRecords, null, 2)}

Please analyze these records and take appropriate actions.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: systemPrompt,
      tools,
      messages: [{ role: 'user', content: userMessage }],
    })

    for (const block of response.content) {
      if (block.type !== 'tool_use') continue

      if (block.name === 'analyze_health_pattern') {
        const input = block.input as { pattern: string; severity: string; affected_areas: string[] }
        console.log('[Orchestrator] Health pattern analysis:', input)
        actions.push(`analyze_health_pattern: ${input.pattern} (severity: ${input.severity})`)

      } else if (block.name === 'create_alert') {
        const input = block.input as { title: string; description: string; severity: 'low' | 'medium' | 'high'; suggestion: string }
        const newAlert: AlertNotification = {
          id: 'orch-alert-' + generateId(),
          userId: record.userId,
          careRecipientId: record.careRecipientId,
          type: 'health_alert',
          title: input.title,
          description: input.description,
          severity: input.severity,
          suggestion: input.suggestion,
          read: false,
          actionUrl: '/guide?auto=care_manager_report',
          createdAt: new Date(),
        }
        alerts.unshift(newAlert)
        console.log('[Orchestrator] Alert created:', newAlert.title)
        actions.push(`create_alert: ${input.title}`)

      } else if (block.name === 'draft_care_manager_message') {
        const input = block.input as { subject: string; body: string; urgency: 'routine' | 'soon' | 'urgent' }
        const draft: CareManagerDraft = {
          subject: input.subject,
          body: input.body,
          urgency: input.urgency,
          createdAt: new Date(),
        }
        careManagerDrafts.unshift(draft)
        console.log('[Orchestrator] Care manager draft created:', input.subject, '(urgency:', input.urgency + ')')
        actions.push(`draft_care_manager_message: ${input.subject} (urgency: ${input.urgency})`)

      } else if (block.name === 'suggest_report_generation') {
        const input = block.input as { reason: string; record_count: number }
        const reportAlert: AlertNotification = {
          id: 'orch-report-' + generateId(),
          userId: record.userId,
          careRecipientId: record.careRecipientId,
          type: 'report_ready',
          title: 'Monthly report generation recommended',
          description: input.reason,
          severity: 'low',
          suggestion: `${input.record_count} records are available. Would you like to generate a monthly report now?`,
          read: false,
          actionUrl: '/report/new',
          createdAt: new Date(),
        }
        alerts.unshift(reportAlert)
        console.log('[Orchestrator] Report suggestion alert created:', input.reason)
        actions.push(`suggest_report_generation: ${input.reason} (${input.record_count} records)`)
      }
    }

    lastOrchestratorResult = { actions, timestamp: new Date() }
    return { actions }
  } catch (err) {
    console.error('[Orchestrator] Error running orchestrator:', err)
    lastOrchestratorResult = { actions, timestamp: new Date() }
    return { actions }
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function cleanJsonResponse(text: string): string {
  return text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
}

function getDemoGuideResponse(message: string): string {
  const lower = message.toLowerCase()

  if (lower.includes('更新') || lower.includes('認定') || lower.includes('介護保険')) {
    return `ゆうさん、節子さんの介護保険の認定有効期限が **2026年4月30日** です。更新手続きが必要ですので、以下を進めてください。

⚠️ **3月31日までに**、区役所に更新申請書を提出しないといけません。認定調査〜結果通知に約1ヶ月かかるため、**今月中の申請が必須**です。

### やることリスト

**① 今週中：ケアマネ佐藤花子さんに電話（TEL: 03-XXXX-1234）**
→ 「更新申請の手続きを進めたい」と伝えてください。佐藤さんが主治医意見書の手配と申請書の記入サポートをしてくれます。

**② 3月14日まで：主治医意見書の依頼**
→ 佐藤さん経由でやまだ内科クリニック（山田太郎先生）に依頼します。直近の受診記録があるので問題ないはずですが、**最近の食欲低下のこともお伝えください**（認定調査に影響します）。

**③ 3月21日まで：区役所 介護保険課へ申請書提出**
→ 最寄りの区役所 介護保険課（平日8:30〜17:00）に以下を持参：
- 介護保険被保険者証（原本）
- 更新申請書（佐藤さんと一緒に記入）
- 健康保険証
- マイナンバーカード（または通知カード）

**④ 4月上旬：認定調査の訪問（自宅）**
→ 調査員が自宅に来ます。節子さんの**普段の様子を正直に**伝えてください。「良く見せよう」としなくてOKです。特に最近の食欲低下やぼんやりしている様子は必ず伝えましょう。

### 💰 費用
更新申請の自己負担は **無料** です。主治医意見書の費用も介護保険から支払われます。

### 💡 ゆうさんへ
認定調査では「できないこと」をしっかり伝えるのがポイントです。佐藤さんに「認定調査の立ち会い」をお願いすることもできるので、相談してみてください。まずは今週中に佐藤さんへの電話から始めましょう！`
  }

  if (lower.includes('デイ') || lower.includes('通所')) {
    return `ゆうさん、節子さんのデイサービスの追加利用についてですね。

現在、節子さんは**火曜・金曜の週2回**デイサービスを利用中です。要介護2の区分支給限度額は**月197,050円**なので、まだ追加の余裕があります。

⚠️ **来週の火曜日までに**ケアマネ佐藤花子さん（TEL: 03-XXXX-1234）に「デイサービスを週3回に増やしたい」と伝えてください。佐藤さんがケアプランの変更手続きを進めてくれます。

### 💰 費用の目安
デイサービス1回あたりの自己負担（1割）: 約**800〜1,000円**（昼食代別途400〜600円）
→ 週1回追加で月額約**5,000〜6,500円**の増加です。

まずは佐藤さんに電話してみてください！`
  }

  if (lower.includes('食欲') || lower.includes('食事') || lower.includes('栄養')) {
    return `ゆうさん、節子さんの食欲低下が3日続いているのは心配ですね。

⚠️ **明日3月8日までに**、主治医の山田太郎先生（やまだ内科クリニック）に電話相談をしてください。3日以上の食欲低下は脱水リスクがあるため、早めの対応が必要です。

**同時に今日中に**ケアマネ佐藤花子さん（TEL: 03-XXXX-1234）にも状況を報告してください。訪問看護の一時的な追加導入を検討してもらえます。

### やること
1. **今日中**: 佐藤さんに電話で食欲低下を報告
2. **明日まで**: やまだ内科に電話相談 → 必要に応じて受診予約
3. **当面**: 水分だけでも摂れるようゼリーやスポーツドリンクを用意

### 💡 ゆうさんへ
一人で抱え込まないでくださいね。佐藤さんはこういう相談のプロです。遠慮なく頼ってOKです！`
  }

  // Default response
  return `ゆうさん、ご質問ありがとうございます。

お手伝いできることをいくつかご案内しますね。節子さんの状況に合わせて具体的にお答えします：

- **介護保険の更新申請** → 認定期限が4月30日なので、今月中に手続きが必要です
- **デイサービスの追加・変更** → 現在週2回ですが、増やすことも可能です
- **食欲低下への対応** → 最近3日間の食欲低下について、主治医・ケアマネへの連絡方法
- **ケアマネ佐藤さんへのメッセージ作成** → 状況報告の下書きをお作りします

どの件について詳しく知りたいですか？`
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/records/structure
app.post('/api/records/structure', async (req, res) => {
  try {
    const { raw_text, images_base64, care_recipient_id } = req.body as {
      raw_text: string
      images_base64?: string[]
      care_recipient_id: string
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      const structuredData: StructuredData = {
        meal: { breakfast: 'Not recorded', lunch: 'Not recorded', dinner: 'Not recorded', hydration: 'Not recorded' },
        elimination: { urine_count: null, stool: 'Not recorded' },
        sleep: { hours: null, quality: 'Not recorded' },
        medication: { taken: null, notes: 'Not recorded' },
        physical: { temperature: null, pain: 'Not recorded', edema: 'Not recorded', other: 'Not recorded' },
        mental: { mood: 'Not recorded', cognition: 'Not recorded', behavior: 'Not recorded' },
        fall_risk: 'Not recorded',
        special_notes: raw_text,
        care_given: [],
      }
      const now = new Date()
      const record: CareRecord = {
        id: generateId(),
        userId: 'demo-user-1',
        careRecipientId: care_recipient_id,
        recordDate: now.toISOString().slice(0, 10),
        recordTime: now.toTimeString().slice(0, 5),
        rawInput: raw_text,
        structuredData,
        photos: images_base64 ?? [],
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      }
      records.push(record)
      return res.json({ id: record.id, structuredData })
    }

    const systemPrompt = `You are a care record structuring assistant.
Extract the standard care diary fields from the following free-text entry.
Do not infer or fill in information beyond what is explicitly stated in the text.

Output in the following JSON format:
{
  "meal": { "breakfast": "", "lunch": "", "dinner": "", "hydration": "" },
  "elimination": { "urine_count": null, "stool": "" },
  "sleep": { "hours": null, "quality": "" },
  "medication": { "taken": null, "notes": "" },
  "physical": { "temperature": null, "pain": "", "edema": "", "other": "" },
  "mental": { "mood": "", "cognition": "", "behavior": "" },
  "fall_risk": "",
  "special_notes": "",
  "care_given": []
}

For any fields not mentioned, use "Not recorded". Return JSON only.`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: 'user', content: raw_text }],
    })

    const rawJson = cleanJsonResponse((response.content[0] as Anthropic.TextBlock).text)
    const structuredData: StructuredData = JSON.parse(rawJson)

    const now = new Date()
    const record: CareRecord = {
      id: generateId(),
      userId: 'demo-user-1',
      careRecipientId: care_recipient_id,
      recordDate: now.toISOString().slice(0, 10),
      recordTime: now.toTimeString().slice(0, 5),
      rawInput: raw_text,
      structuredData,
      photos: images_base64 ?? [],
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    }

    records.push(record)

    res.json({ id: record.id, structuredData })
  } catch (err) {
    console.error('Error in /api/records/structure:', err)
    res.status(500).json({ error: 'Failed to structure record' })
  }
})

// PATCH /api/records/:id
app.patch('/api/records/:id', (req, res) => {
  const record = records.find((r) => r.id === req.params.id)
  if (!record) {
    return res.status(404).json({ error: 'Record not found' })
  }
  record.status = 'saved'
  record.updatedAt = new Date()

  // Run AI orchestrator (fire-and-forget)
  const recentRecords = records
    .filter(r => r.careRecipientId === record.careRecipientId && r.status === 'saved')
    .sort((a, b) => b.recordDate.localeCompare(a.recordDate))
    .slice(0, 7)

  runOrchestrator(record, recentRecords).then(result => {
    console.log('[Orchestrator] Actions taken:', result.actions)
  }).catch(err => {
    console.error('[Orchestrator] Error:', err)
  })

  // After saving record, trigger n8n workflow if configured
  if (N8N_WEBHOOK_URL) {
    // Fire-and-forget: trigger n8n workflow for anomaly detection
    try {
      const recentRecords = records
        .filter(r => r.careRecipientId === record.careRecipientId)
        .sort((a, b) => b.recordDate.localeCompare(a.recordDate))
        .slice(0, 7)

      fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'record_saved',
          record_id: record.id,
          care_recipient_id: record.careRecipientId,
          user_id: record.userId,
          recent_records: recentRecords.map(r => ({
            date: r.recordDate,
            structured_data: r.structuredData,
          })),
        }),
      }).catch(err => console.error('n8n webhook error:', err))
    } catch (err) {
      console.error('n8n trigger error:', err)
    }
  }

  res.json(record)
})

// GET /api/records
app.get('/api/records', (_req, res) => {
  const sorted = [...records].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  res.json(sorted)
})

// GET /api/reports
app.get('/api/reports', (_req, res) => {
  const sorted = [...reports].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  res.json(sorted)
})

// GET /api/documents
app.get('/api/documents', (_req, res) => {
  const sorted = [...documents].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  res.json(sorted)
})

// POST /api/guide/message
app.post('/api/guide/message', async (req, res) => {
  try {
    const { session_id, user_message, prefecture } = req.body as {
      session_id: string | null | undefined
      user_message: string
      prefecture: string
    }

    const activeSessionId: string = session_id ?? generateId()

    if (!sessionHistories[activeSessionId]) {
      sessionHistories[activeSessionId] = []
    }

    const history = sessionHistories[activeSessionId]
    history.push({ role: 'user', content: user_message })

    const isAutoMode = user_message.startsWith('[AUTO:care_manager_report]')
    const actualMessage = isAutoMode
      ? user_message.replace('[AUTO:care_manager_report]', '').trim()
      : user_message

    // Replace the pushed message with the actual (stripped) message
    history[history.length - 1] = { role: 'user', content: actualMessage }

    let systemPrompt = `あなたは介護者「ゆう」さん専属のAIアシスタント「MimamoAI」です。
一般的な制度説明ではなく、「ゆうさんが今何をすべきか」を具体的に指示してください。

## ゆうさんの状況
- 介護者: ゆう（家族介護者・娘）
- 要介護者: 田中節子（78歳・女性）
- 要介護度: 要介護2（現在の認定有効期限: 2026年4月30日）
- 主な疾患: 軽度認知症、高血圧（アムロジピン5mg服用中）
- 担当ケアマネージャー: 佐藤花子（さくら居宅介護支援事業所・TEL: 03-XXXX-1234）
- 主治医: 山田太郎先生（やまだ内科クリニック）
- 利用中サービス: 週2回デイサービス（火・金）、週1回訪問介護（水）
- 居住地: ${prefecture}
- 今日の日付: 2026年3月7日

## 回答スタイル
**「〜までに〜をしないといけないから、〜してください」** という具体的なアクション指示で回答すること。

例:
「節子さんの介護保険の認定有効期限が4月30日なので、**3月31日までに**${prefecture}の区役所介護保険課に更新申請を出さないといけません。まずは**今週中に**ケアマネの佐藤花子さん（TEL: 03-XXXX-1234）に電話して、主治医意見書の手配をお願いしてください。」

## 回答に必ず含める要素
1. **期限と理由**: 「〜までに〜しないといけない。なぜなら〜」
2. **具体的なアクション**: 誰に・何を・いつまでに（ケアマネ佐藤さん、主治医山田先生など実名で）
3. **必要書類**: 田中節子さんの情報を埋めた形で（例:「被保険者番号は保険証に記載のもの」）
4. **費用**: 自己負担額の目安
5. **ゆうさんへの一言**: 励ましや注意点を一言添える

## ルール
- 制度の一般的な説明は最小限にし、「ゆうさんが次にやるべきこと」を最優先で伝える
- ケアマネ佐藤花子さんに任せられることは「佐藤さんに依頼してください」と明示する
- デモ用なので具体的な日付・電話番号・金額を積極的に入れてリアルにする
- 回答は日本語で行うこと`

    if (isAutoMode) {
      systemPrompt += `

## 現在の状況
田中節子さんの食欲が3月5日から3日連続で低下しています。ゆうさんはケアマネージャー佐藤花子さんへ連絡したいと考えています。
件名・本文・相談ポイントを含むメッセージの下書きを、田中節子さんの具体的な状況を盛り込んで作成してください。`
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    // Send session_id immediately so the frontend can track the session
    res.write(`data: ${JSON.stringify({ session_id: activeSessionId })}\n\n`)

    // Demo fallback when no API key
    if (!process.env.ANTHROPIC_API_KEY) {
      const demoResponse = getDemoGuideResponse(actualMessage)
      // Simulate streaming by sending chunks
      const chunks = demoResponse.match(/.{1,20}/gs) ?? [demoResponse]
      for (const chunk of chunks) {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`)
      }
      history.push({ role: 'assistant', content: demoResponse })
      res.write(`data: ${JSON.stringify({ done: true, session_id: activeSessionId })}\n\n`)
      res.end()
      return
    }

    let fullText = ''

    const stream = anthropic.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      temperature: 0.3,
      system: systemPrompt,
      messages: history,
    })

    stream.on('text', (text) => {
      fullText += text
      res.write(`data: ${JSON.stringify({ text })}\n\n`)
    })

    stream.on('finalMessage', () => {
      history.push({ role: 'assistant', content: fullText })
      res.write(`data: ${JSON.stringify({ done: true, session_id: activeSessionId })}\n\n`)
      res.end()
    })

    stream.on('error', (err) => {
      console.error('Stream error in /api/guide/message:', err)
      res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`)
      res.end()
    })
  } catch (err) {
    console.error('Error in /api/guide/message:', err)
    res.status(500).json({ error: 'Failed to process message' })
  }
})

// POST /api/reports/generate
app.post('/api/reports/generate', async (req, res) => {
  try {
    const { care_recipient_id, period_start, period_end, template_type, additional_notes } =
      req.body as {
        care_recipient_id: string
        period_start: string
        period_end: string
        template_type: string
        additional_notes: string
      }

    const periodRecords = records.filter(
      (r) =>
        r.careRecipientId === care_recipient_id &&
        r.recordDate >= period_start &&
        r.recordDate <= period_end,
    )

    const prompt = `You are an assistant for creating monthly care reports to be submitted to the Care Manager (Care Support Specialist).

Care Recipient: Setsuko Tanaka (78 years old, Care Level 2)
Reporting Period: ${period_start} to ${period_end}

Care Record Data:
${JSON.stringify(periodRecords, null, 2)}

Additional Notes: ${additional_notes}

Please create a report in the following JSON format:
{
  "overall_assessment": "Overall assessment (within 200 characters)",
  "adl_summary": "Trends in physical condition and ADL",
  "mental_summary": "Changes in cognitive and mental status",
  "incidents": "Special notes and incidents",
  "handover_notes": "Handover items for the following month"
}

Return JSON only.`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawJson = cleanJsonResponse((response.content[0] as Anthropic.TextBlock).text)
    const reportData = JSON.parse(rawJson)

    const report: CareReport = {
      id: generateId(),
      careRecipientId: care_recipient_id,
      periodStart: period_start,
      periodEnd: period_end,
      templateType: template_type,
      additionalNotes: additional_notes,
      overallAssessment: reportData.overall_assessment,
      adlSummary: reportData.adl_summary,
      mentalSummary: reportData.mental_summary,
      incidents: reportData.incidents,
      handoverNotes: reportData.handover_notes,
      createdAt: new Date(),
    }

    reports.push(report)

    const responsePayload = {
      id: report.id,
      userId: 'demo-user-1',
      careRecipientId: report.careRecipientId,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      templateType: report.templateType,
      additionalNotes: report.additionalNotes,
      pdfUrl: '',
      recordCount: periodRecords.length,
      createdAt: report.createdAt,
      updatedAt: report.createdAt,
      generatedContent: {
        overall_assessment: report.overallAssessment,
        adl_summary: report.adlSummary,
        mental_summary: report.mentalSummary,
        incidents: report.incidents,
        handover_notes: report.handoverNotes,
      },
    }

    res.json(responsePayload)
  } catch (err) {
    console.error('Error in /api/reports/generate:', err)
    res.status(500).json({ error: 'Failed to generate report' })
  }
})

// GET /api/alerts
app.get('/api/alerts', (_req, res) => {
  res.json(alerts)
})

// POST /api/alerts/:id/generate-message
app.post('/api/alerts/:id/generate-message', async (req, res) => {
  try {
    const alert = alerts.find((a) => a.id === req.params.id)
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' })
    }

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentRecords = records.filter(
      (r) => new Date(r.recordDate) >= sevenDaysAgo,
    )

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.json({
        subject: '[Report] Regarding Setsuko Tanaka\'s Decreased Appetite',
        body: 'Dear Hanako Sato,\n\nThank you always for your support. This is Yu, a family member of Setsuko Tanaka.\n\nMy mother\'s food intake has declined for 3 consecutive days starting March 5th.\n- March 5th: Ate about half of breakfast\n- March 6th: Ate almost nothing at breakfast\n- March 7th: Ate almost nothing at breakfast, only a small amount of fluid\n\nAdditionally, since March 6th, mild confusion has been observed and her expression has remained blank/glazed.',
        consultation_points: '- Possible causes of the decreased appetite\n- Whether a medical consultation is necessary\n- Consideration of adding visiting nursing services\n- Use of nutritional supplement foods',
      })
    }

    const prompt = `You are a care record analysis assistant.
Based on the following alert information and recent care records, please draft a message to send to the Care Manager.

Alert: ${alert.title} - ${alert.description}

Recent care records:
${JSON.stringify(recentRecords, null, 2)}

Care Recipient: Setsuko Tanaka (78 years old, Care Level 2)
Care Manager: Hanako Sato

Please draft the message in the following format:
- Subject
- Body (polite and concise, conveying the situation clearly)
- Consultation points (things to confirm or discuss with the Care Manager)

Return the message text only.`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = (response.content[0] as Anthropic.TextBlock).text.trim()

    // Parse subject, body, consultation_points from the generated text
    const subjectMatch = text.match(/Subject[：:]\s*(.+)/iu)
    const consultationMatch = text.match(/Consultation[^:]*[：:]\s*([\s\S]+)$/iu)
    const bodyMatch = text.match(/Body[：:]\s*([\s\S]+?)(?=Consultation|$)/iu)

    res.json({
      subject: subjectMatch ? subjectMatch[1].trim() : 'Report on the condition of Setsuko Tanaka',
      body: bodyMatch ? bodyMatch[1].trim() : text,
      consultation_points: consultationMatch ? consultationMatch[1].trim() : '',
    })
  } catch (err) {
    console.error('Error in /api/alerts/:id/generate-message:', err)
    res.status(500).json({ error: 'Failed to generate message' })
  }
})

// POST /api/records/:id/analyze
app.post('/api/records/:id/analyze', async (req, res) => {
  try {
    const record = records.find((r) => r.id === req.params.id)
    if (!record) {
      return res.status(404).json({ error: 'Record not found' })
    }

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentRecords = records.filter(
      (r) =>
        r.careRecipientId === record.careRecipientId &&
        new Date(r.recordDate) >= sevenDaysAgo,
    )

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.json({
        detected: true,
        pattern: 'Appetite has declined for 3 consecutive days',
        severity: 'high',
        suggestion: 'Reporting to the Care Manager is recommended. There is a risk of dehydration and nutritional deficiency.',
      })
    }

    const prompt = `From the following recent care records, detect any abnormal patterns that require medical attention.

Record data:
${JSON.stringify(recentRecords, null, 2)}

If an abnormal pattern is detected, return the following JSON:
{"detected": true, "pattern": "description of the pattern", "severity": "high", "suggestion": "recommended action"}

If within normal range:
{"detected": false}

Return JSON only.`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawJson = cleanJsonResponse((response.content[0] as Anthropic.TextBlock).text)
    const result = JSON.parse(rawJson)

    res.json(result)
  } catch (err) {
    console.error('Error in /api/records/:id/analyze:', err)
    res.status(500).json({ error: 'Failed to analyze record' })
  }
})

// POST /api/records/doctor-memo
app.post('/api/records/doctor-memo', async (req, res) => {
  try {
    const { care_recipient_id, visit_reason } = req.body as {
      care_recipient_id: string
      visit_reason?: string
    }

    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
    const recentRecords = records.filter(
      (r) =>
        r.careRecipientId === care_recipient_id &&
        new Date(r.recordDate) >= fourteenDaysAgo,
    )

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.json({
        memo: '## Memo for the Doctor\n\n### Basic Information\nSetsuko Tanaka (78 years old, Care Level 2, Mild dementia)\n\n### Recent Changes (by priority)\n- **Decreased appetite (since March 5th):** Ate almost nothing at breakfast for 3 consecutive days. Only a small amount of fluid.\n- **Cognitive changes (since March 6th):** Mild confusion, blank/glazed facial expression\n\n### Vitals and Eating Trends\n- Food intake: 3/5 half→3/6 almost none→3/7 almost none (declining trend)\n- Hydration: Only a small amount recorded on 3/7\n\n### Medication Status\n- Medication recorded on 3/5. Not recorded on 3/6 and 3/7\n\n### Points to Discuss\n- Possible causes of the appetite loss (drug side effects, infection, etc.)\n- Assessment of dehydration risk and countermeasures\n- Whether cognitive changes are drug-induced\n\n### Changes in Daily Life\n- Increased nighttime awakenings (2 awakenings recorded on 3/6)\n- Daytime responsiveness has slowed',
      })
    }

    const prompt = `You are an assistant that summarizes information from home care records to be communicated to a doctor during a medical visit.

Care Recipient: Setsuko Tanaka (78 years old, Care Level 2, Mild dementia, on medication for hypertension)
Reason for Visit: ${visit_reason || 'Routine checkup'}

Care records from the past 14 days:
${JSON.stringify(recentRecords, null, 2)}

Please create a "Memo for the Doctor" in the following format:

## Memo for the Doctor

### Basic Information
- Care recipient's name, age, and care level

### Recent Changes (by priority)
- Bullet points of symptoms and physical changes (since when, to what extent)

### Vitals and Eating Trends
- Summary of food intake, hydration, temperature trends, etc.

### Medication Status
- Note any missed doses or suspected side effects

### Points to Discuss
- Frame concerns identified from the records as questions to ask the doctor

### Changes in Daily Life
- Changes in cognitive, mental, and ADL status

Please keep it concise and readable, covering only what can be communicated within the limited time of an appointment.`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    })

    const memo = (response.content[0] as Anthropic.TextBlock).text.trim()
    res.json({ memo })
  } catch (err) {
    console.error('Error in /api/records/doctor-memo:', err)
    res.status(500).json({ error: 'Failed to generate doctor memo' })
  }
})

// POST /api/records/handover
app.post('/api/records/handover', async (req, res) => {
  try {
    const { care_recipient_id, provider_name, days } = req.body as {
      care_recipient_id: string
      provider_name?: string
      days?: number
    }

    const numDays = days ?? 3
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - numDays)
    const recentRecords = records.filter(
      (r) =>
        r.careRecipientId === care_recipient_id &&
        new Date(r.recordDate) >= cutoff,
    )

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.json({
        summary: '[Handover Summary]\n\n■ Key Points to Watch\n- Appetite has declined for 3 consecutive days. Please carefully monitor food and fluid intake.\n- Please check for signs of dehydration (dry mouth, decreased urine output).\n\n■ Physical Condition Trends\n- Meals: 3/5 half eaten→3/6, 3/7 almost none. Fluid intake also minimal.\n- Elimination: 2 toilet visits recorded on 3/5.\n\n■ Mental Status and Cognition\n- Mild confusion since 3/6. On 3/7, expression appeared blank/glazed.\n- Response to verbal prompts may be slower than usual.\n\n■ Medication Notes\n- If medication is difficult to take due to appetite loss, please consult the Care Manager rather than forcing it.\n\n■ Other\n- 2 nighttime awakenings recorded on 3/6 — please be mindful of possible daytime drowsiness.',
      })
    }

    const prompt = `You are an assistant that drafts handover notes for visiting care helpers and day service providers.

Care Recipient: Setsuko Tanaka (78 years old, Care Level 2)
Handover Recipient: ${provider_name || 'Service Provider'}
Coverage Period: Past ${numDays} days

Care Records:
${JSON.stringify(recentRecords, null, 2)}

Please create a concise handover note in the following format:

[Handover Summary]
■ Key Points to Watch (most important)
■ Physical Condition Trends (meals, elimination, sleep)
■ Mental Status and Cognition
■ Medication Notes
■ Other Items to Communicate

Please use bullet points so the helper can review it at a glance.`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    })

    const summary = (response.content[0] as Anthropic.TextBlock).text.trim()
    res.json({ summary })
  } catch (err) {
    console.error('Error in /api/records/handover:', err)
    res.status(500).json({ error: 'Failed to generate handover summary' })
  }
})

// POST /api/guide/checklist
app.post('/api/guide/checklist', async (req, res) => {
  try {
    const { type } = req.body as {
      type: 'admission' | 'discharge'
      care_recipient_id: string
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      const admissionDemo = [
        {
          category: 'Documents and Procedures',
          items: [
            { text: 'Fill out and submit hospital admission form', done: false },
            { text: 'Bring health insurance card and Long-term Care Insurance card', done: false },
            { text: 'Prepare co-payment limit certification', done: false },
            { text: 'Bring patient card and medication notebook', done: false },
          ],
        },
        {
          category: 'Personal Belongings and Clothing',
          items: [
            { text: 'Pajamas and changes of clothes (3–5 sets)', done: false },
            { text: 'Towels and toiletries', done: false },
            { text: 'Assistive devices such as hearing aids and glasses', done: false },
          ],
        },
        {
          category: 'Medication and Medical',
          items: [
            { text: 'Bring current medications (or medication information sheet)', done: false },
            { text: 'Notify primary care physician', done: false },
            { text: 'Declare allergy information', done: false },
          ],
        },
        {
          category: 'Communication and Handover',
          items: [
            { text: 'Notify Care Manager of hospitalization', done: false },
            { text: 'Cancel day service and visiting care', done: false },
            { text: 'Confirm emergency contact list', done: false },
          ],
        },
      ]

      const dischargeDemo = [
        {
          category: 'Discharge Procedures',
          items: [
            { text: 'Receive discharge summary', done: false },
            { text: 'Request medical certificate and discharge certificate', done: false },
            { text: 'Complete billing and payment', done: false },
          ],
        },
        {
          category: 'Preparing for Home Care',
          items: [
            { text: 'Notify Care Manager of discharge date', done: false },
            { text: 'Resume visiting care and day service', done: false },
            { text: 'Arrange welfare equipment as needed', done: false },
            { text: 'Consider home visit medical care and visiting nursing', done: false },
          ],
        },
        {
          category: 'Medication and Medical Management',
          items: [
            { text: 'Receive and review discharge prescriptions', done: false },
            { text: 'Confirm medication management method (explain to family and helpers)', done: false },
            { text: 'Schedule follow-up appointment with primary care physician', done: false },
          ],
        },
        {
          category: 'Home Environment Setup',
          items: [
            { text: 'Check environment for fall prevention (handrails, steps, etc.)', done: false },
            { text: 'Confirm care arrangements for daily activities such as bathing and meals', done: false },
            { text: 'Confirm emergency contact system', done: false },
          ],
        },
      ]

      return res.json({ checklist: type === 'admission' ? admissionDemo : dischargeDemo })
    }

    const typeLabel = type === 'admission' ? 'hospital admission' : 'hospital discharge'
    const prompt = `You are an assistant supporting family caregivers in home care settings.

Care Recipient: Setsuko Tanaka (78 years old, Care Level 2, Mild dementia, on medication for hypertension)
Checklist Type: ${typeLabel}

Please return a checklist required for ${typeLabel} in the following JSON format. Include 3–4 categories, each with 3–5 items.

[
  {
    "category": "Category Name",
    "items": [
      { "text": "Checklist item", "done": false }
    ]
  }
]

Return JSON only.`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawJson = cleanJsonResponse((response.content[0] as Anthropic.TextBlock).text)
    const checklist = JSON.parse(rawJson)
    res.json({ checklist })
  } catch (err) {
    console.error('Error in /api/guide/checklist:', err)
    res.status(500).json({ error: 'Failed to generate checklist' })
  }
})

// POST /api/chat/classify
app.post('/api/chat/classify', async (req, res) => {
  try {
    const { message } = req.body as { message: string }

    if (!process.env.ANTHROPIC_API_KEY) {
      const m = message.toLowerCase()
      let intent = 'general_chat'
      if (/記録|食事|排泄|睡眠|服薬|体温|朝食|昼食|夕食|トイレ|食べ/.test(m)) intent = 'record_entry'
      else if (/手続き|申請|更新|認定|介護保険|制度|届出|届け出/.test(m)) intent = 'guide_question'
      else if (/報告書|レポート|月次|ケアマネ.*報告/.test(m)) intent = 'report_generation'
      else if (/受診|医師|先生|病院|メモ|ドクター/.test(m)) intent = 'doctor_memo'
      else if (/申し送り|引継|引き継|ヘルパー|デイ/.test(m)) intent = 'handover'
      else if (/チェックリスト|入院|退院/.test(m)) intent = 'checklist'
      else if (/アラート|通知|お知らせ/.test(m)) intent = 'alert_inquiry'
      res.json({ intent, confidence: 0.9, extracted_params: {} })
      return
    }

    const prompt = `あなたは介護支援AIアシスタントです。ユーザーのメッセージを分析し、以下のいずれかの意図に分類してください。

意図の種類:
- record_entry: 介護記録の入力・記録（食事、排泄、睡眠、服薬、身体状況など）
- guide_question: 介護手続きや制度に関する質問・ガイド
- report_generation: 月次報告書やケアマネへの報告書の作成
- doctor_memo: 受診時のメモや医師への伝達事項の作成
- handover: 訪問介護やデイサービスへの引継ぎメモの作成
- checklist: 入院・退院チェックリストの作成
- alert_inquiry: アラートや通知の確認・問い合わせ
- general_chat: 上記に当てはまらない一般的な会話

ユーザーのメッセージ:
${message}

以下のJSON形式のみで回答してください（説明不要）:
{
  "intent": "分類結果",
  "confidence": 0〜1の確信度,
  "extracted_params": { 抽出されたパラメータ（該当する場合）}
}

例:
- 「今日の朝食は半分しか食べなかった」→ {"intent": "record_entry", "confidence": 0.95, "extracted_params": {"meal": "breakfast", "amount": "half"}}
- 「要介護認定の更新手続きを教えて」→ {"intent": "guide_question", "confidence": 0.92, "extracted_params": {"topic": "care_certification_renewal"}}
- 「先月分の報告書を作って」→ {"intent": "report_generation", "confidence": 0.90, "extracted_params": {}}

JSONのみ返してください。マークダウンのコードブロックは使わないでください。`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = (response.content[0] as Anthropic.TextBlock).text.trim()
    const cleanJson = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const result = JSON.parse(cleanJson)

    res.json(result)
  } catch (err) {
    console.error('Error in /api/chat/classify:', err)
    res.status(500).json({ error: 'Failed to classify message' })
  }
})

// ─── Orchestrator Endpoints ────────────────────────────────────────────────────

// GET /api/orchestrator/status
app.get('/api/orchestrator/status', (_req, res) => {
  res.json(lastOrchestratorResult)
})

// POST /api/orchestrator/run
app.post('/api/orchestrator/run', async (req, res) => {
  const recentRecords = records
    .filter(r => r.status === 'saved')
    .sort((a, b) => b.recordDate.localeCompare(a.recordDate))
    .slice(0, 7)

  if (recentRecords.length === 0) {
    return res.json({ actions: [], message: 'No records to analyze' })
  }

  const result = await runOrchestrator(recentRecords[0], recentRecords)
  res.json(result)
})

// ─── n8n Integration Endpoints ────────────────────────────────────────────────

// POST /api/n8n/callback — receives anomaly detection results from n8n
app.post('/api/n8n/callback', (req, res) => {
  const { record_id, user_id, care_recipient_id, alert } = req.body

  if (alert && alert.detected) {
    // Add the alert to in-memory alerts store
    const newAlert: AlertNotification = {
      id: 'n8n-alert-' + Date.now(),
      userId: user_id || 'demo-user-1',
      careRecipientId: care_recipient_id || 'demo-recipient-1',
      type: 'health_alert',
      title: alert.pattern || 'Abnormal pattern detected',
      description: alert.suggestion || '',
      severity: (alert.severity || 'medium') as 'low' | 'medium' | 'high',
      suggestion: alert.suggestion || '',
      read: false,
      actionUrl: '/guide?auto=care_manager_report',
      createdAt: new Date(),
    }
    alerts.unshift(newAlert)
    console.log('[n8n] Alert created:', newAlert.title)
  }

  res.json({ success: true })
})

// GET /api/n8n/status — returns n8n integration status
app.get('/api/n8n/status', (_req, res) => {
  res.json({
    connected: !!N8N_WEBHOOK_URL,
    webhook_url: N8N_WEBHOOK_URL ? '(configured)' : '(not configured)',
  })
})

// ─── Production: serve built frontend ─────────────────────────────────────────

if (isProduction) {
  app.use(express.static(path.join(__dirname, '../dist')))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'))
  })
}

// ─── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`MimamoAI server running on http://localhost:${PORT}`)
})
