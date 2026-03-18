import type { ReportContent } from '../types'

interface PrintableReportProps {
  recipientName: string
  periodStart: string
  periodEnd: string
  authorName: string
  createdDate: string
  content: ReportContent
}

export default function PrintableReport({
  recipientName,
  periodStart,
  periodEnd,
  authorName,
  createdDate,
  content,
}: PrintableReportProps) {
  return (
    <div className="printable-report">
      <style>{`
        .printable-report {
          display: none;
          font-family: 'Inter', 'Noto Sans JP', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', sans-serif;
          color: #1A1A1A;
          padding: 0;
        }
        @media print {
          body * { visibility: hidden; }
          .printable-report, .printable-report * { visibility: visible; }
          .printable-report {
            display: block;
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            padding: 20mm 25mm;
            box-sizing: border-box;
          }
          .pr-header { text-align: center; border-bottom: 2px solid #2D5A3D; padding-bottom: 14px; margin-bottom: 22px; }
          .pr-brand { font-size: 11px; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; color: #2D5A3D; margin-bottom: 6px; }
          .pr-title { font-size: 18px; font-weight: bold; color: #1A1A1A; }
          .pr-subtitle { font-size: 12px; color: #6B7280; margin-top: 3px; }
          .pr-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; margin-bottom: 22px; font-size: 13px; padding: 12px 0; border-bottom: 1px solid #E8E6E1; }
          .pr-meta-item { display: flex; gap: 8px; align-items: baseline; }
          .pr-meta-label { color: #9CA3AF; font-weight: 600; white-space: nowrap; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; width: 64px; flex-shrink: 0; }
          .pr-section { margin-bottom: 18px; }
          .pr-section-title { font-size: 13px; font-weight: 700; color: #2D5A3D; border-left: 3px solid #2D5A3D; padding-left: 8px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
          .pr-section-body { font-size: 13px; line-height: 1.8; color: #1A1A1A; padding-left: 4px; white-space: pre-wrap; }
          .pr-footer { margin-top: 30px; text-align: right; font-size: 11px; color: #9CA3AF; border-top: 1px solid #E8E6E1; padding-top: 8px; }
        }
      `}</style>

      <div className="pr-header">
        <div className="pr-brand">MimamoAI</div>
        <div className="pr-title">Monthly Report for Care Manager</div>
        <div className="pr-subtitle">Care Manager Monthly Report</div>
      </div>

      <div className="pr-meta">
        <div className="pr-meta-item">
          <span className="pr-meta-label">Care Recipient</span>
          <span>{recipientName}</span>
        </div>
        <div className="pr-meta-item">
          <span className="pr-meta-label">Created By</span>
          <span>{authorName}</span>
        </div>
        <div className="pr-meta-item">
          <span className="pr-meta-label">Report Period</span>
          <span>{periodStart} 〜 {periodEnd}</span>
        </div>
        <div className="pr-meta-item">
          <span className="pr-meta-label">Date Created</span>
          <span>{createdDate}</span>
        </div>
      </div>

      <div className="pr-section">
        <div className="pr-section-title">1. Overall Assessment</div>
        <div className="pr-section-body">{content.overall_assessment}</div>
      </div>

      <div className="pr-section">
        <div className="pr-section-title">2. Physical & ADL Trends</div>
        <div className="pr-section-body">{content.adl_summary}</div>
      </div>

      <div className="pr-section">
        <div className="pr-section-title">3. Cognitive & Mental Status Changes</div>
        <div className="pr-section-body">{content.mental_summary}</div>
      </div>

      <div className="pr-section">
        <div className="pr-section-title">4. Notable Events & Incidents</div>
        <div className="pr-section-body">{content.incidents}</div>
      </div>

      <div className="pr-section">
        <div className="pr-section-title">5. Handover Notes for Next Month</div>
        <div className="pr-section-body">{content.handover_notes}</div>
      </div>

      <div className="pr-footer">
        MimamoAI Auto-generated — {createdDate}
      </div>
    </div>
  )
}
