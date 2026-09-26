import React from 'react';

export default function AISuggestionModal({
  suggestions,
  onAccept,
  onClose
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 8, 15, 0.78)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
        zIndex: 1000
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(680px, 100%)',
          maxHeight: '80vh',
          overflowY: 'auto',
          background: 'linear-gradient(180deg, #171b2a 0%, #10131d 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px',
          boxShadow: '0 24px 70px rgba(0,0,0,0.45)',
          color: '#fff',
          padding: '24px'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '16px',
            marginBottom: '22px'
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 11px',
                background: 'rgba(99,102,241,0.14)',
                border: '1px solid rgba(99,102,241,0.24)',
                borderRadius: '999px',
                color: '#a5b4fc',
                fontSize: '12px',
                fontWeight: '700',
                marginBottom: '10px'
              }}
            >
              ✨ AI WORKFLOW ASSISTANT
            </div>

            <h2
              style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: '800',
                letterSpacing: '-0.4px'
              }}
            >
              Dependency Suggestions
            </h2>

            <p
              style={{
                margin: '8px 0 0',
                color: '#9ca3af',
                fontSize: '13px',
                lineHeight: '1.5'
              }}
            >
              Review the suggested task relationships and link the ones
              that make sense for your workflow.
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close AI suggestions"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.05)',
              color: '#d1d5db',
              cursor: 'pointer',
              fontSize: '18px',
              lineHeight: 1
            }}
          >
            ✕
          </button>
        </div>

        {/* Suggestion list */}
        {suggestions.length === 0 ? (
          <div
            style={{
              padding: '34px 20px',
              borderRadius: '16px',
              border: '1px dashed rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.025)',
              textAlign: 'center'
            }}
          >
            <div
              style={{
                fontSize: '34px',
                marginBottom: '12px'
              }}
            >
              🔍
            </div>

            <h3
              style={{
                margin: '0 0 8px',
                fontSize: '16px'
              }}
            >
              No new suggestions
            </h3>

            <p
              style={{
                margin: 0,
                color: '#9ca3af',
                fontSize: '13px'
              }}
            >
              There are no new dependency suggestions available right now.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            {suggestions.map((item, index) => (
              <div
                key={index}
                style={{
                  background: 'rgba(255,255,255,0.035)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '16px',
                  padding: '16px',
                  transition: 'transform 0.2s ease, border-color 0.2s ease'
                }}
              >
                {/* Relationship */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px',
                    marginBottom: '12px'
                  }}
                >
                  <div
                    style={{
                      padding: '7px 10px',
                      borderRadius: '9px',
                      background: 'rgba(59,130,246,0.12)',
                      border: '1px solid rgba(59,130,246,0.22)',
                      color: '#93c5fd',
                      fontSize: '12px',
                      fontWeight: '700'
                    }}
                  >
                    Task #{item.suggestedPrerequisiteId}
                  </div>

                  <div
                    style={{
                      color: '#6b7280',
                      fontSize: '18px'
                    }}
                  >
                    →
                  </div>

                  <div
                    style={{
                      padding: '7px 10px',
                      borderRadius: '9px',
                      background: 'rgba(99,102,241,0.12)',
                      border: '1px solid rgba(99,102,241,0.22)',
                      color: '#c4b5fd',
                      fontSize: '12px',
                      fontWeight: '700'
                    }}
                  >
                    Task #{item.taskId}
                  </div>
                </div>

                {/* Reason */}
                <div
                  style={{
                    display: 'flex',
                    gap: '9px',
                    alignItems: 'flex-start',
                    marginBottom: '14px'
                  }}
                >
                  <span
                    style={{
                      fontSize: '14px',
                      marginTop: '1px'
                    }}
                  >
                    💡
                  </span>

                  <p
                    style={{
                      margin: 0,
                      color: '#b8bec9',
                      fontSize: '13px',
                      lineHeight: '1.55'
                    }}
                  >
                    {item.reason || 'AI suggested this dependency based on the current task workflow.'}
                  </p>
                </div>

                {/* Action */}
                <button
                  onClick={() => onAccept(item)}
                  style={{
                    width: '100%',
                    border: 'none',
                    borderRadius: '11px',
                    padding: '11px 14px',
                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 8px 22px rgba(79,70,229,0.22)'
                  }}
                >
                  🔗 Accept Dependency
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid rgba(255,255,255,0.06)'
          }}
        >
          <button
            onClick={onClose}
            style={{
              border: '1px solid rgba(255,255,255,0.09)',
              background: 'rgba(255,255,255,0.04)',
              color: '#d1d5db',
              padding: '10px 16px',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}