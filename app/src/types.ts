export interface User {
  id: string
  email: string
  name: string
  prefecture: string
  createdAt: Date
  updatedAt: Date
}

export interface CareRecipient {
  id: string
  userId: string
  name: string
  birthDate: string
  gender: 'male' | 'female' | 'other'
  careLevel: 'support1' | 'support2' | 'care1' | 'care2' | 'care3' | 'care4' | 'care5' | 'none'
  primaryDoctor: string
  careManager: string
  careManagerContact: string
  notes: string
  createdAt: Date
  updatedAt: Date
}

export interface StructuredData {
  meal: {
    breakfast: string
    lunch: string
    dinner: string
    hydration: string
  }
  elimination: {
    urine_count: number | null
    stool: string
  }
  sleep: {
    hours: number | null
    quality: string
  }
  medication: {
    taken: boolean | null
    notes: string
  }
  physical: {
    temperature: number | null
    pain: string
    edema: string
    other: string
  }
  mental: {
    mood: string
    cognition: string
    behavior: string
  }
  fall_risk: string
  special_notes: string
  care_given: string[]
}

export interface CareRecord {
  id: string
  userId: string
  careRecipientId: string
  recordDate: string
  recordTime: string
  rawInput: string
  structuredData: StructuredData | null
  photos: string[]
  status: 'draft' | 'saved'
  createdAt: Date
  updatedAt: Date
}

export interface ReportContent {
  overall_assessment: string
  adl_summary: string
  mental_summary: string
  incidents: string
  handover_notes: string
}

export interface Report {
  id: string
  userId: string
  careRecipientId: string
  periodStart: string
  periodEnd: string
  templateType: 'standard' | 'simple'
  generatedContent: ReportContent | null
  additionalNotes: string
  pdfUrl: string
  recordCount: number
  createdAt: Date
  updatedAt: Date
}

export interface GuideMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface GuideSession {
  id: string
  userId: string
  messages: GuideMessage[]
  category: string
  generatedDocuments: { title: string; content: string }[]
  createdAt: Date
  updatedAt: Date
}

export interface AlertNotification {
  id: string
  userId: string
  careRecipientId: string
  type: 'health_alert' | 'renewal_reminder' | 'report_ready'
  title: string
  description: string
  severity: 'low' | 'medium' | 'high'
  suggestion: string
  read: boolean
  actionUrl?: string
  createdAt: Date
}

export interface Document {
  id: string;
  type: 'doctor_memo' | 'handover' | 'checklist' | 'insurance_form';
  title: string;
  content: string;
  createdAt: Date;
}

// Chat-first UI types
export type ChatIntent =
  | 'record_entry'
  | 'guide_question'
  | 'report_generation'
  | 'doctor_memo'
  | 'handover'
  | 'checklist'
  | 'alert_inquiry'
  | 'general_chat';

export interface IntentClassification {
  intent: ChatIntent;
  confidence: number;
  extracted_params: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: ChatIntent;
  resultData?: unknown; // Structured result from API (CareRecord, Report, etc.)
  isStreaming?: boolean;
}
