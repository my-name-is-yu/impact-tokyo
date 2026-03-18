import type { AlertNotification } from '../../types'

export interface AlertPanelProps {
  alert: AlertNotification
  onClick: (alert: AlertNotification) => void
}

function severityDotColor(severity: AlertNotification['severity']): string {
  switch (severity) {
    case 'high': return 'var(--danger)'
    case 'medium': return 'var(--warning)'
    default: return '#22c55e'
  }
}

export default function AlertPanel({ alert, onClick }: AlertPanelProps) {
  const dotColor = severityDotColor(alert.severity)
  const truncatedDesc =
    alert.description.length > 50
      ? alert.description.slice(0, 50) + '…'
      : alert.description

  return (
    <button
      onClick={() => onClick(alert)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        width: '100%',
        padding: '10px 12px',
        borderRadius: 10,
        border: 'none',
        backgroundColor: 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background-color 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface-alt)'
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
      }}
    >
      {/* Severity dot */}
      <span
        style={{
          display: 'block',
          flexShrink: 0,
          width: 7,
          height: 7,
          borderRadius: '50%',
          backgroundColor: dotColor,
          marginTop: 5,
        }}
      />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {alert.title}
          </span>
          {/* Unread indicator */}
          {!alert.read && (
            <span
              style={{
                display: 'block',
                flexShrink: 0,
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: 'var(--primary)',
              }}
            />
          )}
        </div>
        <p
          style={{
            fontSize: 11,
            color: 'var(--text-tertiary)',
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          {truncatedDesc}
        </p>
      </div>
    </button>
  )
}
