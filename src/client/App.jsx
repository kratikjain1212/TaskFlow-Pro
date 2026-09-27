import React, { useEffect, useMemo, useState } from 'react';
import KanbanBoard from './components/KanbanBoard';
import AISuggestionModal from './components/AISuggestionModal';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const COLUMNS = [
  'Backlog',
  'In Progress',
  'Review',
  'Done'
];

function App() {
  const [tasks, setTasks] = useState([]);

  const [showAIModal, setShowAIModal] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState('');

  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState('');

  const [successMessage, setSuccessMessage] = useState('');

  /*
   * When an AI dependency is being accepted,
   * this value is set and the whole application
   * is temporarily blocked until the backend
   * operation finishes.
   */
  const [acceptingSuggestionKey, setAcceptingSuggestionKey] =
    useState('');

  const fetchTasks = async () => {
    try {
      setTasksError('');

      const response = await fetch(
        `${API_BASE_URL}/api/tasks`
      );

      let data = [];

      try {
        data = await response.json();
      } catch {
        data = [];
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            `Failed to fetch tasks: ${response.status}`
        );
      }

      setTasks(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (error) {
      console.error(
        'Error fetching tasks:',
        error
      );

      setTasksError(
        'Unable to load tasks. Please check that the backend and database are running.'
      );
    } finally {
      setTasksLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const getDependencyStatus = (task) => {
    if (
      task?.dependencyStatus === 'Blocked' ||
      task?.dependency_status === 'Blocked'
    ) {
      return 'Blocked';
    }

    if (
      task?.dependencyStatus === 'Ready' ||
      task?.dependency_status === 'Ready'
    ) {
      return 'Ready';
    }

    const prerequisiteIds =
      Array.isArray(task?.prerequisite_ids)
        ? task.prerequisite_ids.map(Number)
        : [];

    if (prerequisiteIds.length === 0) {
      return 'Ready';
    }

    const prerequisites =
      prerequisiteIds
        .map((id) =>
          tasks.find(
            (item) =>
              Number(item.id) === id
          )
        )
        .filter(Boolean);

    if (
      prerequisites.length !==
      prerequisiteIds.length
    ) {
      return 'Blocked';
    }

    return prerequisites.every(
      (prerequisite) =>
        prerequisite.status_column === 'Done'
    )
      ? 'Ready'
      : 'Blocked';
  };

  const handleOpenAISuggestions =
    async () => {
      setLoadingAI(true);
      setAiError('');
      setSuccessMessage('');

      try {
        const responsePromise =
          fetch(
            `${API_BASE_URL}/api/ai/suggest`
          );

        /*
         * Keep loading visible long enough
         * to provide clear feedback even when
         * the API responds very quickly.
         */
        const minimumLoadingTime =
          new Promise((resolve) =>
            setTimeout(resolve, 600)
          );

        const response =
          await responsePromise;

        let data = [];

        try {
          data = await response.json();
        } catch {
          data = [];
        }

        await minimumLoadingTime;

        if (!response.ok) {
          throw new Error(
            data?.message ||
              data?.error ||
              `Failed to fetch AI suggestions: ${response.status}`
          );
        }

        setAiSuggestions(
          Array.isArray(data)
            ? data
            : []
        );

        setShowAIModal(true);
      } catch (error) {
        console.error(
          'Error fetching AI suggestions:',
          error
        );

        setAiError(
          'AI suggestions are unavailable. Please check your OpenAI API key and try again.'
        );
      } finally {
        setLoadingAI(false);
      }
    };

  const handleAcceptSuggestion =
    async (suggestion) => {
      /*
       * Prevent accidental double submission.
       */
      if (acceptingSuggestionKey) {
        return;
      }

      try {
        setAiError('');
        setSuccessMessage('');

        const prerequisiteTaskId =
          Number(
            suggestion?.suggestedPrerequisiteId
          );

        const dependentTaskId =
          Number(
            suggestion?.taskId
          );

        if (
          !Number.isInteger(
            prerequisiteTaskId
          ) ||
          !Number.isInteger(
            dependentTaskId
          )
        ) {
          throw new Error(
            'Invalid AI dependency suggestion.'
          );
        }

        const suggestionKey =
          `${prerequisiteTaskId}-${dependentTaskId}`;

        /*
         * Start global loading/lock state
         * BEFORE making the backend request.
         */
        setAcceptingSuggestionKey(
          suggestionKey
        );

        const response =
          await fetch(
            `${API_BASE_URL}/api/dependencies`,
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json'
              },
              body: JSON.stringify({
                prerequisite_task_id:
                  prerequisiteTaskId,
                dependent_task_id:
                  dependentTaskId
              })
            }
          );

        let data = {};

        try {
          data =
            await response.json();
        } catch {
          data = {};
        }

        if (!response.ok) {
          throw new Error(
            data?.message ||
              data?.error ||
              `Failed to add dependency: ${response.status}`
          );
        }

        /*
         * Wait for fresh backend data before
         * removing the loading state.
         */
        await fetchTasks();

        setShowAIModal(false);

        setSuccessMessage(
          `Dependency linked successfully: Task #${prerequisiteTaskId} → Task #${dependentTaskId}`
        );

        window.setTimeout(
          () => {
            setSuccessMessage('');
          },
          3500
        );
      } catch (error) {
        console.error(
          'Error accepting AI suggestion:',
          error
        );

        setAiError(
          error.message ||
            'Failed to accept the AI dependency suggestion.'
        );
      } finally {
        /*
         * Unlock the application only after
         * the complete operation finishes.
         */
        setAcceptingSuggestionKey('');
      }
    };

  const stats = useMemo(() => {
    let blocked = 0;
    let ready = 0;
    let inProgress = 0;
    let review = 0;
    let completed = 0;

    for (const task of tasks) {
      const dependencyStatus =
        getDependencyStatus(task);

      if (
        dependencyStatus === 'Blocked'
      ) {
        blocked += 1;
      } else {
        ready += 1;
      }

      if (
        task.status_column ===
        'In Progress'
      ) {
        inProgress += 1;
      }

      if (
        task.status_column ===
        'Review'
      ) {
        review += 1;
      }

      if (
        task.status_column ===
        'Done'
      ) {
        completed += 1;
      }
    }

    return {
      total: tasks.length,
      blocked,
      ready,
      inProgress,
      review,
      completed
    };
  }, [tasks]);

  const statCardStyle = {
    padding: '17px 18px',
    borderRadius: '17px',
    background:
      'rgba(255,255,255,0.035)',
    border:
      '1px solid rgba(255,255,255,0.07)'
  };

  const statLabelStyle = {
    color: '#94a3b8',
    fontSize: '11px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.7px'
  };

  const statValueStyle = {
    marginTop: '8px',
    fontSize: '27px',
    fontWeight: '850'
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, rgba(79,70,229,0.12), transparent 30%), #0b0d12',
        color: '#f8fafc',
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        padding: '28px'
      }}
    >
      <div
        style={{
          maxWidth: '1500px',
          margin: '0 auto'
        }}
      >
        <header
          style={{
            display: 'flex',
            justifyContent:
              'space-between',
            alignItems: 'center',
            gap: '20px',
            flexWrap: 'wrap',
            padding: '24px 26px',
            borderRadius: '22px',
            background:
              'linear-gradient(135deg, rgba(24,29,43,0.96), rgba(15,18,27,0.96))',
            border:
              '1px solid rgba(255,255,255,0.08)',
            boxShadow:
              '0 18px 50px rgba(0,0,0,0.25)',
            marginBottom: '22px'
          }}
        >
          <div>
            <div
              style={{
                display:
                  'inline-flex',
                alignItems:
                  'center',
                gap: '8px',
                padding:
                  '7px 11px',
                borderRadius:
                  '999px',
                background:
                  'rgba(99,102,241,0.12)',
                border:
                  '1px solid rgba(99,102,241,0.22)',
                color:
                  '#a5b4fc',
                fontSize: '11px',
                fontWeight:
                  '800',
                letterSpacing:
                  '0.5px',
                marginBottom:
                  '12px'
              }}
            >
              ◈ DEPENDENCY-AWARE WORKFLOW
            </div>

            <h1
              style={{
                margin: 0,
                fontSize:
                  'clamp(28px, 4vw, 40px)',
                lineHeight: '1.1',
                fontWeight:
                  '850',
                letterSpacing:
                  '-1px',
                color:
                  '#f8fafc'
              }}
            >
              TaskFlow Pro
            </h1>

            <p
              style={{
                margin:
                  '9px 0 0',
                color:
                  '#94a3b8',
                fontSize:
                  '14px',
                lineHeight:
                  '1.5'
              }}
            >
              DAG-powered workflow management with dependency validation,
              scheduling, and AI-assisted suggestions.
            </p>
          </div>

          <button
            type="button"
            onClick={
              handleOpenAISuggestions
            }
            disabled={
              loadingAI ||
              Boolean(
                acceptingSuggestionKey
              )
            }
            style={{
              display:
                'inline-flex',
              alignItems:
                'center',
              justifyContent:
                'center',
              gap: '9px',
              minWidth:
                '205px',
              padding:
                '13px 18px',
              border: 'none',
              borderRadius:
                '13px',
              background:
                'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: '#fff',
              fontSize:
                '13px',
              fontWeight:
                '800',
              cursor:
                loadingAI ||
                acceptingSuggestionKey
                  ? 'not-allowed'
                  : 'pointer',
              opacity:
                loadingAI ||
                acceptingSuggestionKey
                  ? 0.7
                  : 1,
              boxShadow:
                '0 10px 28px rgba(79,70,229,0.28)'
            }}
          >
            <span
              style={{
                fontSize: '16px'
              }}
            >
              {loadingAI
                ? '⏳'
                : '✨'}
            </span>

            {loadingAI
              ? 'Analyzing Workflow...'
              : 'AI Suggest Dependencies'}
          </button>
        </header>

        {loadingAI && (
          <div
            style={{
              display: 'flex',
              alignItems:
                'center',
              gap: '14px',
              padding:
                '16px 18px',
              marginBottom:
                '18px',
              background:
                'rgba(99,102,241,0.08)',
              border:
                '1px solid rgba(99,102,241,0.22)',
              borderLeft:
                '4px solid #6366f1',
              borderRadius:
                '14px',
              color:
                '#c7d2fe'
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius:
                  '50%',
                border:
                  '3px solid rgba(255,255,255,0.12)',
                borderTopColor:
                  '#818cf8',
                animation:
                  'spin 0.9s linear infinite',
                flexShrink: 0
              }}
            />

            <div>
              <strong
                style={{
                  fontSize: '13px'
                }}
              >
                AI is analyzing your workflow...
              </strong>

              <div
                style={{
                  marginTop:
                    '4px',
                  color:
                    '#94a3b8',
                  fontSize:
                    '12px'
                }}
              >
                Reviewing task titles and descriptions for meaningful dependency suggestions.
              </div>
            </div>
          </div>
        )}

        {aiError && (
          <div
            style={{
              display: 'flex',
              alignItems:
                'flex-start',
              justifyContent:
                'space-between',
              gap: '12px',
              padding:
                '13px 15px',
              marginBottom:
                '18px',
              background:
                'rgba(239,68,68,0.08)',
              border:
                '1px solid rgba(239,68,68,0.20)',
              borderLeft:
                '4px solid #ef4444',
              borderRadius:
                '13px',
              color:
                '#fecaca',
              fontSize:
                '12px',
              lineHeight:
                '1.5'
            }}
          >
            <div>
              <strong>
                ⚠ AI Suggestions Unavailable
              </strong>

              <div
                style={{
                  marginTop:
                    '3px'
                }}
              >
                {aiError}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setAiError('')
              }
              style={{
                border: 'none',
                background:
                  'transparent',
                color:
                  '#fecaca',
                cursor:
                  'pointer',
                fontSize:
                  '16px'
              }}
            >
              ×
            </button>
          </div>
        )}

        {successMessage && (
          <div
            style={{
              display: 'flex',
              alignItems:
                'center',
              justifyContent:
                'space-between',
              gap: '12px',
              padding:
                '13px 15px',
              marginBottom:
                '18px',
              background:
                'rgba(16,185,129,0.09)',
              border:
                '1px solid rgba(16,185,129,0.22)',
              borderLeft:
                '4px solid #10b981',
              borderRadius:
                '13px',
              color:
                '#a7f3d0',
              fontSize:
                '12px',
              lineHeight:
                '1.5'
            }}
          >
            <div>
              <strong>
                ✓ Dependency Linked
              </strong>

              <div
                style={{
                  marginTop:
                    '3px'
                }}
              >
                {successMessage}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setSuccessMessage('')
              }
              style={{
                border: 'none',
                background:
                  'transparent',
                color:
                  '#a7f3d0',
                cursor:
                  'pointer',
                fontSize:
                  '16px',
                padding: 0
              }}
            >
              ×
            </button>
          </div>
        )}

        {tasksError && (
          <div
            style={{
              padding:
                '13px 15px',
              marginBottom:
                '18px',
              background:
                'rgba(239,68,68,0.08)',
              border:
                '1px solid rgba(239,68,68,0.20)',
              borderLeft:
                '4px solid #ef4444',
              borderRadius:
                '13px',
              color:
                '#fecaca',
              fontSize:
                '12px',
              lineHeight:
                '1.5'
            }}
          >
            <strong>
              ⚠ Unable to Load Workflow
            </strong>

            <div
              style={{
                marginTop:
                  '3px'
              }}
            >
              {tasksError}
            </div>
          </div>
        )}

        <section
          style={{
            display:
              'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '12px',
            marginBottom:
              '22px'
          }}
        >
          <div
            style={statCardStyle}
          >
            <div
              style={statLabelStyle}
            >
              Total Tasks
            </div>

            <div
              style={
                statValueStyle
              }
            >
              {stats.total}
            </div>
          </div>

          <div
            style={statCardStyle}
          >
            <div
              style={statLabelStyle}
            >
              Blocked
            </div>

            <div
              style={{
                ...statValueStyle,
                color:
                  '#fb7185'
              }}
            >
              {stats.blocked}
            </div>
          </div>

          <div
            style={statCardStyle}
          >
            <div
              style={statLabelStyle}
            >
              Ready
            </div>

            <div
              style={{
                ...statValueStyle,
                color:
                  '#60a5fa'
              }}
            >
              {stats.ready}
            </div>
          </div>

          <div
            style={statCardStyle}
          >
            <div
              style={statLabelStyle}
            >
              In Progress
            </div>

            <div
              style={{
                ...statValueStyle,
                color:
                  '#fbbf24'
              }}
            >
              {stats.inProgress}
            </div>
          </div>

          <div
            style={statCardStyle}
          >
            <div
              style={statLabelStyle}
            >
              Review
            </div>

            <div
              style={{
                ...statValueStyle,
                color:
                  '#c084fc'
              }}
            >
              {stats.review}
            </div>
          </div>

          <div
            style={statCardStyle}
          >
            <div
              style={statLabelStyle}
            >
              Completed
            </div>

            <div
              style={{
                ...statValueStyle,
                color:
                  '#34d399'
              }}
            >
              {stats.completed}
            </div>
          </div>
        </section>

        {tasksLoading ? (
          <div
            style={{
              minHeight:
                '280px',
              display:
                'flex',
              alignItems:
                'center',
              justifyContent:
                'center',
              flexDirection:
                'column',
              gap:
                '12px',
              borderRadius:
                '20px',
              background:
                'rgba(255,255,255,0.025)',
              border:
                '1px solid rgba(255,255,255,0.06)'
            }}
          >
            <div
              style={{
                width:
                  '34px',
                height:
                  '34px',
                borderRadius:
                  '50%',
                border:
                  '3px solid rgba(255,255,255,0.12)',
                borderTopColor:
                  '#818cf8',
                animation:
                  'spin 0.9s linear infinite'
              }}
            />

            <div
              style={{
                color:
                  '#94a3b8',
                fontSize:
                  '13px'
              }}
            >
              Loading workflow...
            </div>
          </div>
        ) : (
          <KanbanBoard
            tasks={tasks}
            columns={COLUMNS}
            onTaskRefresh={
              fetchTasks
            }
          />
        )}

        {showAIModal && (
          <AISuggestionModal
            suggestions={
              aiSuggestions
            }
            onAccept={
              handleAcceptSuggestion
            }
            onClose={() => {
              if (
                !acceptingSuggestionKey
              ) {
                setShowAIModal(
                  false
                );
              }
            }}
          />
        )}
      </div>

      {/* =========================================================
          GLOBAL ACTION LOADING OVERLAY

          While an AI dependency is being accepted,
          block the complete application temporarily.
          ========================================================= */}
      {acceptingSuggestionKey && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 5000,
            display: 'flex',
            alignItems:
              'center',
            justifyContent:
              'center',
            background:
              'rgba(5,8,15,0.72)',
            backdropFilter:
              'blur(6px)',
            WebkitBackdropFilter:
              'blur(6px)',
            cursor:
              'wait'
          }}
          aria-live="polite"
          aria-busy="true"
        >
          <div
            style={{
              width:
                'min(390px, calc(100% - 40px))',
              padding:
                '28px 26px',
              borderRadius:
                '18px',
              background:
                'linear-gradient(180deg, #171b2a 0%, #10131d 100%)',
              border:
                '1px solid rgba(255,255,255,0.10)',
              boxShadow:
                '0 24px 70px rgba(0,0,0,0.45)',
              textAlign:
                'center',
              color:
                '#f8fafc'
            }}
          >
            <div
              style={{
                width:
                  '46px',
                height:
                  '46px',
                margin:
                  '0 auto 16px',
                borderRadius:
                  '50%',
                border:
                  '4px solid rgba(255,255,255,0.12)',
                borderTopColor:
                  '#818cf8',
                animation:
                  'spin 0.9s linear infinite'
              }}
            />

            <div
              style={{
                fontSize:
                  '18px',
                fontWeight:
                  '800',
                marginBottom:
                  '7px'
              }}
            >
              Linking Dependency...
            </div>

            <div
              style={{
                color:
                  '#94a3b8',
                fontSize:
                  '13px',
                lineHeight:
                  '1.5'
              }}
            >
              Saving the dependency and recalculating the workflow.
              Please wait.
            </div>
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }

            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </div>
  );
}

export default App;