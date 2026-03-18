"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const https_1 = require("firebase-functions/v2/https");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const demo_seed_js_1 = require("./demo-seed.js");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json({ limit: '10mb' }));
const anthropic = new sdk_1.default({ apiKey: process.env.ANTHROPIC_API_KEY });
// Seeded demo records
const records = [...demo_seed_js_1.demoRecords];
const reports = [...demo_seed_js_1.demoReports];
const documents = [...demo_seed_js_1.demoDocuments];
const alerts = [
    {
        id: 'alert-1',
        userId: 'demo-user-1',
        careRecipientId: 'demo-recipient-1',
        type: 'health_alert',
        title: 'Appetite has been declining for 3 consecutive days',
        description: 'Appetite has been declining since March 5. There is a risk of dehydration and malnutrition. Reporting to the Care Manager is recommended.',
        severity: 'high',
        suggestion: 'We recommend reporting the situation to the Care Manager (Hanako Sato). Would you like to draft a message?',
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
        description: 'The Long-term Care Insurance certification for Setsuko Tanaka expires at the end of April 2026. Let\'s start preparing for the renewal process.',
        severity: 'medium',
        suggestion: 'Would you like to review the renewal process guide? We can help you prepare the required documents.',
        read: false,
        actionUrl: '/guide',
        createdAt: new Date('2026-03-06T09:00:00'),
    },
    {
        id: 'alert-3',
        userId: 'demo-user-1',
        careRecipientId: 'demo-recipient-1',
        type: 'report_ready',
        title: 'February monthly report draft has been created',
        description: 'A draft report for the Care Manager has been created based on the February 2026 care records. Please review and edit as needed.',
        severity: 'low',
        suggestion: 'Would you like to review the report?',
        read: false,
        actionUrl: '/report/new',
        createdAt: new Date('2026-03-01T09:00:00'),
    },
];
// Conversation history per session
const sessionHistories = {};
// ─── Helpers ───────────────────────────────────────────────────────────────────
function generateId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
function cleanJsonResponse(text) {
    return text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
}
// ─── Orchestrator ─────────────────────────────────────────────────────────────
let lastOrchestratorResult = null;
async function runOrchestrator(record, recentRecords) {
    const actions = [];
    try {
        const tools = [
            {
                name: 'analyze_health_pattern',
                description: 'Analyze recent care records to detect health anomaly patterns (e.g., declining appetite, sleep issues, cognitive changes). Call this when you want to check for concerning trends.',
                input_schema: {
                    type: 'object',
                    properties: {
                        pattern: { type: 'string', description: 'Description of the detected pattern' },
                        severity: {
                            type: 'string',
                            enum: ['low', 'medium', 'high'],
                            description: 'Severity level',
                        },
                        affected_areas: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Areas affected (e.g., meal, sleep, cognition)',
                        },
                    },
                    required: ['pattern', 'severity', 'affected_areas'],
                },
            },
            {
                name: 'create_alert',
                description: 'Create a proactive alert notification for the caregiver. Use when a concerning pattern is detected that the caregiver should know about.',
                input_schema: {
                    type: 'object',
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
                    type: 'object',
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
                    type: 'object',
                    properties: {
                        reason: { type: 'string', description: 'Why a report should be generated now' },
                        record_count: {
                            type: 'number',
                            description: 'Number of records available for the report',
                        },
                    },
                    required: ['reason', 'record_count'],
                },
            },
        ];
        const systemPrompt = `You are the MimamoAI Orchestrator — an AI agent that proactively monitors care records and takes autonomous actions to support family caregivers.

You have just received a newly saved care record along with recent records from the past 7 days. Your job is to:
1. Analyze the records for any concerning health patterns or trends
2. If you detect an issue, create an alert AND draft a care manager message if the severity is medium or high
3. If enough records have accumulated (5+ in the current month), suggest generating a monthly report

Care recipient: Setsuko Tanaka (Age 78, Care Level 2, mild dementia, hypertension medication)
Care manager: Hanako Sato

Be proactive but not alarmist. Only flag genuinely concerning patterns. Use the tools available to take action.`;
        const userContent = `New care record just saved:
${JSON.stringify(record, null, 2)}

Recent records from the past 7 days (${recentRecords.length} total):
${JSON.stringify(recentRecords, null, 2)}`;
        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 2000,
            system: systemPrompt,
            tools,
            messages: [{ role: 'user', content: userContent }],
        });
        for (const block of response.content) {
            if (block.type !== 'tool_use')
                continue;
            const input = block.input;
            if (block.name === 'analyze_health_pattern') {
                const pattern = input.pattern;
                const severity = input.severity;
                const affectedAreas = input.affected_areas;
                console.log(`[Orchestrator] Health pattern analysis — severity: ${severity}, areas: ${affectedAreas.join(', ')}, pattern: ${pattern}`);
                actions.push(`analyze_health_pattern: ${pattern}`);
            }
            else if (block.name === 'create_alert') {
                const alert = {
                    id: generateId(),
                    userId: record.userId,
                    careRecipientId: record.careRecipientId,
                    type: 'health_alert',
                    title: input.title,
                    description: input.description,
                    severity: input.severity,
                    suggestion: input.suggestion,
                    read: false,
                    actionUrl: '/guide',
                    createdAt: new Date(),
                };
                alerts.push(alert);
                console.log(`[Orchestrator] Alert created: ${alert.title}`);
                actions.push(`create_alert: ${alert.title}`);
            }
            else if (block.name === 'draft_care_manager_message') {
                const subject = input.subject;
                const body = input.body;
                const urgency = input.urgency;
                console.log(`[Orchestrator] Care manager message drafted — urgency: ${urgency}, subject: ${subject}\n${body}`);
                actions.push(`draft_care_manager_message: ${subject}`);
            }
            else if (block.name === 'suggest_report_generation') {
                const reason = input.reason;
                const recordCount = input.record_count;
                const alert = {
                    id: generateId(),
                    userId: record.userId,
                    careRecipientId: record.careRecipientId,
                    type: 'report_ready',
                    title: 'Monthly report is ready to generate',
                    description: reason,
                    severity: 'low',
                    suggestion: 'Would you like to generate the monthly report now?',
                    read: false,
                    actionUrl: '/report/new',
                    createdAt: new Date(),
                };
                alerts.push(alert);
                console.log(`[Orchestrator] Report generation suggested — ${recordCount} records available: ${reason}`);
                actions.push(`suggest_report_generation: ${reason}`);
            }
        }
    }
    catch (err) {
        console.error('[Orchestrator] Error during orchestration:', err);
    }
    lastOrchestratorResult = { actions, timestamp: new Date() };
    return { actions };
}
// ─── Routes ───────────────────────────────────────────────────────────────────
// POST /api/records/structure
app.post('/api/records/structure', async (req, res) => {
    try {
        const { raw_text, images_base64, care_recipient_id } = req.body;
        if (!process.env.ANTHROPIC_API_KEY) {
            const structuredData = {
                meal: { breakfast: 'Not recorded', lunch: 'Not recorded', dinner: 'Not recorded', hydration: 'Not recorded' },
                elimination: { urine_count: null, stool: 'Not recorded' },
                sleep: { hours: null, quality: 'Not recorded' },
                medication: { taken: null, notes: 'Not recorded' },
                physical: { temperature: null, pain: 'Not recorded', edema: 'Not recorded', other: 'Not recorded' },
                mental: { mood: 'Not recorded', cognition: 'Not recorded', behavior: 'Not recorded' },
                fall_risk: 'Not recorded',
                special_notes: raw_text,
                care_given: [],
            };
            const now = new Date();
            const record = {
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
            };
            records.push(record);
            res.json({ id: record.id, structuredData });
            return;
        }
        const systemPrompt = `You are a care record structuring assistant.
From the following free-text description, extract each field of a standard care diary.
Do not guess or infer — only record information that can be directly read from the text.

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

For fields not mentioned in the text, use "Not recorded". Return JSON only.`;
        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1000,
            temperature: 0,
            system: systemPrompt,
            messages: [{ role: 'user', content: raw_text }],
        });
        const rawJson = cleanJsonResponse(response.content[0].text);
        const structuredData = JSON.parse(rawJson);
        const now = new Date();
        const record = {
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
        };
        records.push(record);
        res.json({ id: record.id, structuredData });
    }
    catch (err) {
        console.error('Error in /api/records/structure:', err);
        res.status(500).json({ error: 'Failed to structure record' });
    }
});
// PATCH /api/records/:id
app.patch('/api/records/:id', (req, res) => {
    const record = records.find((r) => r.id === req.params.id);
    if (!record) {
        res.status(404).json({ error: 'Record not found' });
        return;
    }
    record.status = 'saved';
    record.updatedAt = new Date();
    res.json(record);
    const recentRecords = records
        .filter(r => r.careRecipientId === record.careRecipientId && r.status === 'saved')
        .sort((a, b) => b.recordDate.localeCompare(a.recordDate))
        .slice(0, 7);
    runOrchestrator(record, recentRecords).then(result => {
        console.log('[Orchestrator] Actions taken:', result.actions);
    }).catch(err => {
        console.error('[Orchestrator] Error:', err);
    });
});
// GET /api/records
app.get('/api/records', (_req, res) => {
    const sorted = [...records].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(sorted);
});
// GET /api/reports
app.get('/api/reports', (_req, res) => {
    const sorted = [...reports].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(sorted);
});
// GET /api/documents
app.get('/api/documents', (_req, res) => {
    const sorted = [...documents].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(sorted);
});
// POST /api/guide/message
app.post('/api/guide/message', async (req, res) => {
    try {
        const { session_id, user_message, prefecture } = req.body;
        const activeSessionId = session_id ?? generateId();
        if (!sessionHistories[activeSessionId]) {
            sessionHistories[activeSessionId] = [];
        }
        const history = sessionHistories[activeSessionId];
        history.push({ role: 'user', content: user_message });
        const isAutoMode = user_message.startsWith('[AUTO:care_manager_report]');
        const actualMessage = isAutoMode
            ? user_message.replace('[AUTO:care_manager_report]', '').trim()
            : user_message;
        // Replace the pushed message with the actual (stripped) message
        history[history.length - 1] = { role: 'user', content: actualMessage };
        let systemPrompt = `You are an expert assistant for caregiving procedures and administrative processes.
You are well-versed in Japan's Long-term Care Insurance system and social security system, and you help family caregivers navigate procedures with confidence.

User's prefecture: ${prefecture}

Please respond in the following format:
1. Overview of the procedure (what it is for)
2. Step-by-step list (numbered, 1–2 lines per step)
3. Required documents list
4. Where to apply
5. Important notes and common mistakes

For any regulations or regional details that are unclear, explicitly state "Please confirm with your local municipal office" — do not guess.
If the user asks to "draft a document", generate draft text for that document.`;
        if (isAutoMode) {
            systemPrompt += `

Current situation: The care recipient (Setsuko Tanaka, age 78, Care Level 2) has had a declining appetite for 3 consecutive days. The user would like to draft a message to the Care Manager.
Please create a draft message including: subject line, body text, and consultation points.`;
        }
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        // Send session_id immediately so the frontend can track the session
        res.write(`data: ${JSON.stringify({ session_id: activeSessionId })}\n\n`);
        let fullText = '';
        const stream = anthropic.messages.stream({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1500,
            temperature: 0.3,
            system: systemPrompt,
            messages: history,
        });
        stream.on('text', (text) => {
            fullText += text;
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
        });
        stream.on('finalMessage', () => {
            history.push({ role: 'assistant', content: fullText });
            res.write(`data: ${JSON.stringify({ done: true, session_id: activeSessionId })}\n\n`);
            res.end();
        });
        stream.on('error', (err) => {
            console.error('Stream error in /api/guide/message:', err);
            res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
            res.end();
        });
    }
    catch (err) {
        console.error('Error in /api/guide/message:', err);
        res.status(500).json({ error: 'Failed to process message' });
    }
});
// POST /api/reports/generate
app.post('/api/reports/generate', async (req, res) => {
    try {
        const { care_recipient_id, period_start, period_end, template_type, additional_notes } = req.body;
        const periodRecords = records.filter((r) => r.careRecipientId === care_recipient_id &&
            r.recordDate >= period_start &&
            r.recordDate <= period_end);
        const prompt = `You are an assistant for creating monthly reports addressed to the Care Manager (Long-term Care Support Specialist).

Care recipient: Setsuko Tanaka (age 78, Care Level 2)
Reporting period: ${period_start} to ${period_end}

Care record data:
${JSON.stringify(periodRecords, null, 2)}

Additional notes: ${additional_notes}

Please create a report in the following JSON format:
{
  "overall_assessment": "Overall assessment (within 200 characters)",
  "adl_summary": "Physical condition and ADL trends",
  "mental_summary": "Changes in cognitive and mental status",
  "incidents": "Special notes and incidents",
  "handover_notes": "Handover notes for next month"
}

Return JSON only.`;
        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 2000,
            temperature: 0.2,
            messages: [{ role: 'user', content: prompt }],
        });
        const rawJson = cleanJsonResponse(response.content[0].text);
        const reportData = JSON.parse(rawJson);
        const report = {
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
        };
        reports.push(report);
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
        };
        res.json(responsePayload);
    }
    catch (err) {
        console.error('Error in /api/reports/generate:', err);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});
// GET /api/alerts
app.get('/api/alerts', (_req, res) => {
    res.json(alerts);
});
// POST /api/alerts/:id/generate-message
app.post('/api/alerts/:id/generate-message', async (req, res) => {
    try {
        const alert = alerts.find((a) => a.id === req.params.id);
        if (!alert) {
            res.status(404).json({ error: 'Alert not found' });
            return;
        }
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentRecords = records.filter((r) => new Date(r.recordDate) >= sevenDaysAgo);
        if (!process.env.ANTHROPIC_API_KEY) {
            res.json({
                subject: '[Report] Regarding Setsuko Tanaka\'s Reduced Appetite',
                body: 'Dear Hanako Sato,\n\nThank you always for your support. This is Yu, a family member of Setsuko Tanaka.\n\nMy mother\'s food intake has been declining for 3 consecutive days since March 5.\n- March 5: Ate about half of breakfast\n- March 6: Ate almost none of breakfast\n- March 7: Ate almost none of breakfast, only a small amount of fluid\n\nIn addition, mild confusion has been observed since March 6, and she has continued to appear blank and listless.',
                consultation_points: '- Possible causes of the reduced appetite\n- Whether a medical visit is necessary\n- Consideration of adding visiting nursing care\n- Potential use of nutritional supplements',
            });
            return;
        }
        const prompt = `You are a care record analysis assistant.
Based on the following alert information and recent care records, please draft a message to the Care Manager.

Alert: ${alert.title} - ${alert.description}

Recent care records:
${JSON.stringify(recentRecords, null, 2)}

Care recipient: Setsuko Tanaka (age 78, Care Level 2)
Assigned Care Manager: Hanako Sato

Please draft the message in the following format:
- Subject
- Body (politely and concisely describing the situation)
- Consultation points (things to confirm or discuss with the Care Manager)

Return the message only.`;
        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 800,
            temperature: 0.2,
            messages: [{ role: 'user', content: prompt }],
        });
        const text = response.content[0].text.trim();
        // Parse subject, body, consultation_points from the generated text
        const subjectMatch = text.match(/Subject[：:]\s*(.+)/u);
        const consultationMatch = text.match(/Consultation [Pp]oints[：:]\s*([\s\S]+)$/u);
        const bodyMatch = text.match(/Body[：:]\s*([\s\S]+?)(?=Consultation [Pp]oints[：:]|$)/u);
        res.json({
            subject: subjectMatch ? subjectMatch[1].trim() : 'Report on the condition of Setsuko Tanaka',
            body: bodyMatch ? bodyMatch[1].trim() : text,
            consultation_points: consultationMatch ? consultationMatch[1].trim() : '',
        });
    }
    catch (err) {
        console.error('Error in /api/alerts/:id/generate-message:', err);
        res.status(500).json({ error: 'Failed to generate message' });
    }
});
// POST /api/records/:id/analyze
app.post('/api/records/:id/analyze', async (req, res) => {
    try {
        const record = records.find((r) => r.id === req.params.id);
        if (!record) {
            res.status(404).json({ error: 'Record not found' });
            return;
        }
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentRecords = records.filter((r) => r.careRecipientId === record.careRecipientId &&
            new Date(r.recordDate) >= sevenDaysAgo);
        if (!process.env.ANTHROPIC_API_KEY) {
            res.json({
                detected: true,
                pattern: 'Appetite has been declining for 3 consecutive days',
                severity: 'high',
                suggestion: 'Reporting to the Care Manager is recommended. There is a risk of dehydration and malnutrition.',
            });
            return;
        }
        const prompt = `From the following recent care records, detect any abnormal patterns that may require medical attention.

Record data:
${JSON.stringify(recentRecords, null, 2)}

If an abnormal pattern is detected, return the following JSON:
{"detected": true, "pattern": "Description of the pattern", "severity": "high", "suggestion": "Recommended action"}

If within normal range:
{"detected": false}

Return JSON only.`;
        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 500,
            temperature: 0,
            messages: [{ role: 'user', content: prompt }],
        });
        const rawJson = cleanJsonResponse(response.content[0].text);
        const result = JSON.parse(rawJson);
        res.json(result);
    }
    catch (err) {
        console.error('Error in /api/records/:id/analyze:', err);
        res.status(500).json({ error: 'Failed to analyze record' });
    }
});
// POST /api/orchestrator/run — manual trigger for demo
app.post('/api/orchestrator/run', async (req, res) => {
    const recentRecords = records
        .filter(r => r.status === 'saved')
        .sort((a, b) => b.recordDate.localeCompare(a.recordDate))
        .slice(0, 7);
    if (recentRecords.length === 0) {
        res.json({ actions: [], message: 'No records to analyze' });
        return;
    }
    const result = await runOrchestrator(recentRecords[0], recentRecords);
    res.json(result);
});
// GET /api/orchestrator/status
app.get('/api/orchestrator/status', (_req, res) => {
    res.json(lastOrchestratorResult || { actions: [], timestamp: null });
});
// POST /api/chat/classify
app.post('/api/chat/classify', async (req, res) => {
    try {
        const { message } = req.body;
        if (!process.env.ANTHROPIC_API_KEY) {
            res.json({ intent: 'general_chat', confidence: 0.5, extracted_params: {} });
            return;
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

JSONのみ返してください。マークダウンのコードブロックは使わないでください。`;
        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 300,
            temperature: 0,
            messages: [{ role: 'user', content: prompt }],
        });
        const rawText = response.content[0].text.trim();
        const cleanJson = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        const result = JSON.parse(cleanJson);
        res.json(result);
    }
    catch (err) {
        console.error('Error in /api/chat/classify:', err);
        res.status(500).json({ error: 'Failed to classify message' });
    }
});
// ─── Export as Cloud Function ──────────────────────────────────────────────────
exports.api = (0, https_1.onRequest)({ memory: '512MiB', timeoutSeconds: 300, region: 'asia-northeast1', secrets: ['ANTHROPIC_API_KEY'] }, app);
//# sourceMappingURL=index.js.map