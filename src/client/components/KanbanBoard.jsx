import React, { useEffect, useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const WORKFLOW_COLUMNS = [
  'Backlog',
  'In Progress',
  'Review',
  'Done'
];

const COLUMN_META = {
  Backlog: {
    icon: '📋',
    accent: '#a5b4fc',
    soft: 'rgba(165,180,252,0.10)',
    border: 'rgba(165,180,252,0.20)'
  },
  'In Progress': {
    icon: '◉',
    accent: '#60a5fa',
    soft: 'rgba(96,165,250,0.10)',
    border: 'rgba(96,165,250,0.22)'
  },
  Review: {
    icon: '◌',
    accent: '#fbbf24',
    soft: 'rgba(251,191,36,0.10)',
    border: 'rgba(251,191,36,0.22)'
  },
  Done: {
    icon: '✓',
    accent: '#34d399',
    soft: 'rgba(52,211,153,0.10)',
    border: 'rgba(52,211,153,0.22)'
  }
};

const DEPENDENCY_META = {
  Blocked: {
    icon: '⛔',
    accent: '#fb7185',
    soft: 'rgba(251,113,133,0.10)',
    border: 'rgba(251,113,133,0.22)'
  },
  Ready: {
    icon: '✓',
    accent: '#34d399',
    soft: 'rgba(52,211,153,0.10)',
    border: 'rgba(52,211,153,0.22)'
  }
};

export default function KanbanBoard({
  tasks,
  columns,
  onTaskCreate,
  onTaskRefresh
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [statusColumn, setStatusColumn] = useState('Backlog');
  const [prerequisiteInput, setPrerequisiteInput] = useState('');

  const [nextTaskId, setNextTaskId] = useState('');

  const todayStr = useMemo(() => {
    return new Date().toLocaleDateString('en-CA');
  }, []);

  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  const [errorMsg, setErrorMsg] = useState('');

  const [deleteTaskId, setDeleteTaskId] = useState('');

  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editPrereqInput, setEditPrereqInput] = useState('');

  const [editingDateTaskId, setEditingDateTaskId] = useState(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');

  const [draggedTaskId, setDraggedTaskId] = useState(null);

  const [isBusy, setIsBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState('');

  const [confirmation, setConfirmation] = useState(null);

  const safeColumns =
    Array.isArray(columns) && columns.length > 0
      ? WORKFLOW_COLUMNS.filter((column) => columns.includes(column))
      : WORKFLOW_COLUMNS;

  const getTaskId = (task) => Number(task.id);

  const getWorkflowStatus = (task) => {
    return WORKFLOW_COLUMNS.includes(task?.status_column)
      ? task.status_column
      : 'Backlog';
  };

  const getPrerequisiteIds = (task) => {
    if (Array.isArray(task?.prerequisite_ids)) {
      return task.prerequisite_ids.map(Number).filter(Number.isInteger);
    }

    if (Array.isArray(task?.prerequisites)) {
      return task.prerequisites
        .map((item) =>
          typeof item === 'object' ? Number(item.id) : Number(item)
        )
        .filter(Number.isInteger);
    }

    return [];
  };

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

    const prerequisiteIds = getPrerequisiteIds(task);

    if (prerequisiteIds.length === 0) {
      return 'Ready';
    }

    const prerequisiteTasks = prerequisiteIds
      .map((id) =>
        tasks.find((item) => Number(item.id) === Number(id))
      )
      .filter(Boolean);

    if (prerequisiteTasks.length !== prerequisiteIds.length) {
      return 'Blocked';
    }

    return prerequisiteTasks.every(
      (prerequisite) => prerequisite.status_column === 'Done'
    )
      ? 'Ready'
      : 'Blocked';
  };

  const refreshTasks = async () => {
    if (onTaskRefresh) {
      await onTaskRefresh();
    }
  };

  const fetchNextId = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tasks/next-id`
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      if (data?.nextId !== undefined && data?.nextId !== null) {
        setNextTaskId(data.nextId);
      }
    } catch (error) {
      console.error('Failed to fetch next task ID:', error);
    }
  };

  useEffect(() => {
    fetchNextId();
  }, [tasks.length]);

  const startBusy = (message) => {
    setBusyMessage(message);
    setIsBusy(true);
  };

  const stopBusy = () => {
    setIsBusy(false);
    setBusyMessage('');
  };

  const parsePrerequisiteInput = (input) => {
    if (!input.trim()) {
      return [];
    }

    const parts = input
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const ids = [];

    for (const part of parts) {
      if (!/^\d+$/.test(part)) {
        return null;
      }

      const id = Number(part);

      if (!Number.isInteger(id) || id <= 0) {
        return null;
      }

      ids.push(id);
    }

    const uniqueIds = [...new Set(ids)];

    if (uniqueIds.length !== ids.length) {
      return null;
    }

    return uniqueIds;
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setErrorMsg('');

    if (!title.trim()) {
      setErrorMsg('Task title is required.');
      return;
    }

    if (!startDate || !endDate) {
      setErrorMsg('Start Date and End Date are required.');
      return;
    }

    if (startDate > endDate) {
      setErrorMsg('Start Date cannot be after End Date.');
      return;
    }

    const prerequisiteIds = parsePrerequisiteInput(
      prerequisiteInput
    );

    if (prerequisiteIds === null) {
      setErrorMsg(
        'Prerequisite IDs must be positive integers separated by commas, without duplicates.'
      );
      return;
    }

    startBusy('Creating task...');

    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          status_column: statusColumn,
          start_date: startDate,
          end_date: endDate,
          prerequisite_ids: prerequisiteIds
        })
      });

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            `Failed to create task (${response.status}).`
        );
      }

      setTitle('');
      setDescription('');
      setPrerequisiteInput('');
      setStatusColumn('Backlog');
      setStartDate(todayStr);
      setEndDate(todayStr);

      if (onTaskCreate) {
        onTaskCreate(data);
      }

      await fetchNextId();
      await refreshTasks();
    } catch (error) {
      console.error('Create task error:', error);
      setErrorMsg(error.message || 'Failed to create task.');
    } finally {
      stopBusy();
    }
  };

  const handleTaskMove = async (taskId, targetColumn) => {
    setErrorMsg('');

    if (!WORKFLOW_COLUMNS.includes(targetColumn)) {
      return;
    }

    const task = tasks.find(
      (item) => Number(item.id) === Number(taskId)
    );

    if (!task) {
      setErrorMsg('Task not found.');
      return;
    }

    const currentColumn = getWorkflowStatus(task);

    if (currentColumn === targetColumn) {
      return;
    }

    startBusy(`Moving task to ${targetColumn}...`);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tasks/${taskId}/status`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            status_column: targetColumn
          })
        }
      );

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            `Unable to move task (${response.status}).`
        );
      }

      await refreshTasks();
    } catch (error) {
      console.error('Task move error:', error);
      setErrorMsg(
        error.message ||
          'Unable to move the task.'
      );
    } finally {
      stopBusy();
    }
  };

  const handleDragStart = (event, taskId) => {
    if (isBusy) {
      event.preventDefault();
      return;
    }

    setDraggedTaskId(Number(taskId));
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(
      'text/plain',
      String(taskId)
    );
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (event, targetColumn) => {
    event.preventDefault();

    const droppedId =
      draggedTaskId ||
      Number(event.dataTransfer.getData('text/plain'));

    if (!droppedId) {
      setDraggedTaskId(null);
      return;
    }

    const task = tasks.find(
      (item) => Number(item.id) === Number(droppedId)
    );

    if (!task) {
      setDraggedTaskId(null);
      return;
    }

    const currentColumn = getWorkflowStatus(task);

    setDraggedTaskId(null);

    if (currentColumn !== targetColumn) {
      await handleTaskMove(droppedId, targetColumn);
    }
  };

  const beginPrerequisiteEdit = (task) => {
    const ids = getPrerequisiteIds(task);

    setEditingTaskId(Number(task.id));
    setEditPrereqInput(ids.join(', '));
    setErrorMsg('');
  };

  const cancelPrerequisiteEdit = () => {
    setEditingTaskId(null);
    setEditPrereqInput('');
  };

  const handleUpdatePrerequisites = async (taskId) => {
    setErrorMsg('');

    const prerequisiteIds = parsePrerequisiteInput(
      editPrereqInput
    );

    if (prerequisiteIds === null) {
      setErrorMsg(
        'Prerequisite IDs must be positive integers separated by commas, without duplicates.'
      );
      return;
    }

    startBusy('Updating dependencies...');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tasks/${taskId}/prerequisites`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prerequisite_ids: prerequisiteIds
          })
        }
      );

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            `Failed to update prerequisites (${response.status}).`
        );
      }

      cancelPrerequisiteEdit();
      await refreshTasks();
    } catch (error) {
      console.error('Prerequisite update error:', error);
      setErrorMsg(
        error.message ||
          'Failed to update prerequisites.'
      );
    } finally {
      stopBusy();
    }
  };

  const beginDateEdit = (task) => {
    const start =
      task.start_date
        ? String(task.start_date).slice(0, 10)
        : '';

    const end =
      task.end_date
        ? String(task.end_date).slice(0, 10)
        : '';

    setEditingDateTaskId(Number(task.id));
    setEditStartDate(start);
    setEditEndDate(end);
    setErrorMsg('');
  };

  const cancelDateEdit = () => {
    setEditingDateTaskId(null);
    setEditStartDate('');
    setEditEndDate('');
  };

  const handleUpdateDates = async (taskId) => {
    setErrorMsg('');

    if (!editStartDate || !editEndDate) {
      setErrorMsg('Start Date and End Date are required.');
      return;
    }

    if (editStartDate > editEndDate) {
      setErrorMsg('Start Date cannot be after End Date.');
      return;
    }

    startBusy('Updating dates & schedule...');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tasks/${taskId}/dates`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            start_date: editStartDate,
            end_date: editEndDate
          })
        }
      );

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            `Failed to update dates (${response.status}).`
        );
      }

      cancelDateEdit();
      await refreshTasks();
    } catch (error) {
      console.error('Date update error:', error);
      setErrorMsg(
        error.message ||
          'Failed to update dates.'
      );
    } finally {
      stopBusy();
    }
  };

  const requestDeleteTask = (taskId) => {
    setConfirmation({
      type: 'delete',
      taskId: Number(taskId)
    });
  };

  const confirmDeleteTask = async () => {
    if (!confirmation?.taskId) {
      return;
    }

    const taskId = confirmation.taskId;

    setConfirmation(null);
    setErrorMsg('');
    startBusy('Deleting task...');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tasks/${taskId}`,
        {
          method: 'DELETE'
        }
      );

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            `Failed to delete task (${response.status}).`
        );
      }

      if (Number(deleteTaskId) === Number(taskId)) {
        setDeleteTaskId('');
      }

      await fetchNextId();
      await refreshTasks();
    } catch (error) {
      console.error('Delete task error:', error);
      setErrorMsg(
        error.message ||
          'Failed to delete task.'
      );
    } finally {
      stopBusy();
    }
  };

  const handleDeleteById = () => {
    setErrorMsg('');

    const id = Number(deleteTaskId);

    if (!Number.isInteger(id) || id <= 0) {
      setErrorMsg('Enter a valid task ID.');
      return;
    }

    const exists = tasks.some(
      (task) => Number(task.id) === id
    );

    if (!exists) {
      setErrorMsg(`Task #${id} does not exist.`);
      return;
    }

    requestDeleteTask(id);
  };

  const requestClearAll = () => {
    if (tasks.length === 0) {
      return;
    }

    setConfirmation({
      type: 'clearAll'
    });
  };

  const confirmClearAllTasks = async () => {
    setConfirmation(null);
    setErrorMsg('');
    startBusy('Clearing all tasks...');

    try {
      for (const task of tasks) {
        const response = await fetch(
          `${API_BASE_URL}/api/tasks/${task.id}`,
          {
            method: 'DELETE'
          }
        );

        if (!response.ok) {
          let data = {};

          try {
            data = await response.json();
          } catch {
            data = {};
          }

          throw new Error(
            data?.message ||
              data?.error ||
              `Failed to delete task #${task.id}.`
          );
        }
      }

      setDeleteTaskId('');

      await fetchNextId();
      await refreshTasks();
    } catch (error) {
      console.error('Clear all error:', error);

      setErrorMsg(
        error.message ||
          'Failed to clear all tasks.'
      );
    } finally {
      stopBusy();
    }
  };

  const formatDate = (value) => {
    if (!value) {
      return 'Not set';
    }

    return String(value).slice(0, 10);
  };

  const getPrerequisiteTitles = (task) => {
    const ids = getPrerequisiteIds(task);

    if (ids.length === 0) {
      return 'None';
    }

    return ids
      .map((id) => {
        const prerequisite = tasks.find(
          (item) => Number(item.id) === Number(id)
        );

        if (!prerequisite) {
          return `#${id}`;
        }

        return `#${id} ${prerequisite.title}`;
      })
      .join(', ');
  };

  const groupedTasks = useMemo(() => {
    const groups = {};

    for (const column of WORKFLOW_COLUMNS) {
      groups[column] = [];
    }

    for (const task of tasks) {
      const column = getWorkflowStatus(task);

      if (!groups[column]) {
        groups[column] = [];
      }

      groups[column].push(task);
    }

    return groups;
  }, [tasks]);

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '11px 12px',
    background: '#111827',
    color: '#f8fafc',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    outline: 'none',
    fontSize: '12px'
  };

  const primaryButtonStyle = {
    width: '100%',
    border: 'none',
    borderRadius: '10px',
    padding: '11px 14px',
    background:
      'linear-gradient(135deg, #6366f1, #4f46e5)',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '800',
    cursor: 'pointer'
  };

  const secondaryButtonStyle = {
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#dbe4f0',
    padding: '7px 10px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '10px',
    fontWeight: '750'
  };

  const dangerButtonStyle = {
    ...secondaryButtonStyle,
    color: '#fb7185',
    border:
      '1px solid rgba(251,113,133,0.18)',
    background:
      'rgba(251,113,133,0.05)'
  };

  return (
    <>
      <style>{`
        @keyframes taskflowSpinner {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .tf-board-shell {
          width: 100%;
          color: #f8fafc;
        }

        .tf-board-topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        .tf-section-title {
          margin: 0;
          font-size: 22px;
          line-height: 1.2;
          font-weight: 850;
          letter-spacing: -0.5px;
        }

        .tf-section-subtitle {
          margin: 6px 0 0;
          color: #8f9bb0;
          font-size: 12px;
          line-height: 1.5;
        }

        .tf-action-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .tf-delete-group {
          display: flex;
          align-items: center;
          overflow: hidden;
          border-radius: 10px;
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .tf-delete-input {
          width: 80px;
          padding: 9px 10px;
          border: none;
          outline: none;
          background: transparent;
          color: #f8fafc;
          font-size: 11px;
        }

        .tf-board-form {
          display: grid;
          grid-template-columns:
            72px
            minmax(170px, 1.4fr)
            minmax(170px, 1.1fr)
            135px
            135px
            135px
            minmax(170px, 1fr)
            105px;
          gap: 10px;
          align-items: end;
          padding: 17px;
          margin-bottom: 20px;
          border-radius: 17px;
          background:
            linear-gradient(
              180deg,
              rgba(255,255,255,0.045),
              rgba(255,255,255,0.025)
            );
          border: 1px solid rgba(255,255,255,0.07);
          box-shadow: 0 12px 34px rgba(0,0,0,0.16);
        }

        .tf-field {
          min-width: 0;
        }

        .tf-field-label {
          display: block;
          margin-bottom: 6px;
          color: #8f9bb0;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.7px;
        }

        .tf-id-value {
          padding: 11px 8px;
          border-radius: 10px;
          background: rgba(99,102,241,0.10);
          border: 1px solid rgba(99,102,241,0.18);
          color: #c4b5fd;
          text-align: center;
          font-size: 13px;
          font-weight: 850;
        }

        .tf-error {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 14px;
          margin-bottom: 17px;
          border-left: 4px solid #ef4444;
          border-radius: 12px;
          background: rgba(239,68,68,0.08);
          border-top: 1px solid rgba(239,68,68,0.16);
          border-right: 1px solid rgba(239,68,68,0.16);
          border-bottom: 1px solid rgba(239,68,68,0.16);
          color: #fecaca;
          font-size: 11px;
          line-height: 1.5;
        }

        .tf-error-close {
          border: none;
          background: transparent;
          color: #fecaca;
          font-size: 16px;
          cursor: pointer;
          padding: 0;
        }

        .tf-columns {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(265px, 1fr));
          gap: 13px;
          overflow-x: auto;
          padding-bottom: 8px;
        }

        .tf-column {
          min-height: 500px;
          padding: 12px;
          border-radius: 16px;
          background: rgba(255,255,255,0.023);
          border: 1px solid rgba(255,255,255,0.07);
          transition:
            border-color 0.2s ease,
            background 0.2s ease,
            box-shadow 0.2s ease;
        }

        .tf-column:hover {
          border-color: rgba(255,255,255,0.12);
        }

        .tf-column-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 3px 3px 12px;
          margin-bottom: 11px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }

        .tf-column-heading {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 850;
        }

        .tf-column-icon {
          width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          font-size: 13px;
        }

        .tf-column-count {
          min-width: 24px;
          padding: 5px 7px;
          border-radius: 999px;
          background: rgba(255,255,255,0.06);
          color: #cbd5e1;
          font-size: 10px;
          text-align: center;
          font-weight: 850;
        }

        .tf-empty {
          min-height: 110px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 18px;
          border-radius: 12px;
          border: 1px dashed rgba(255,255,255,0.09);
          color: #64748b;
          font-size: 10px;
          text-align: center;
        }

        .tf-task-card {
          padding: 13px;
          margin-bottom: 11px;
          border-radius: 14px;
          background:
            linear-gradient(
              180deg,
              rgba(255,255,255,0.055),
              rgba(255,255,255,0.032)
            );
          border: 1px solid rgba(255,255,255,0.07);
          box-shadow: 0 9px 23px rgba(0,0,0,0.16);
          cursor: grab;
          transition:
            transform 0.17s ease,
            border-color 0.17s ease,
            box-shadow 0.17s ease;
        }

        .tf-task-card:hover {
          transform: translateY(-2px);
          border-color: rgba(255,255,255,0.13);
          box-shadow: 0 14px 28px rgba(0,0,0,0.21);
        }

        .tf-task-card:active {
          cursor: grabbing;
        }

        .tf-task-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 9px;
        }

        .tf-badge-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
        }

        .tf-id-badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 7px;
          border-radius: 7px;
          background: rgba(99,102,241,0.10);
          border: 1px solid rgba(99,102,241,0.17);
          color: #c4b5fd;
          font-size: 9px;
          font-weight: 850;
        }

        .tf-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 7px;
          border-radius: 7px;
          font-size: 9px;
          font-weight: 850;
        }

        .tf-card-delete {
          border: none;
          background: transparent;
          color: #7b8798;
          padding: 2px;
          font-size: 11px;
          cursor: pointer;
        }

        .tf-card-delete:hover {
          color: #fb7185;
        }

        .tf-task-title {
          margin: 0;
          color: #f8fafc;
          font-size: 14px;
          line-height: 1.4;
          font-weight: 850;
        }

        .tf-task-description {
          margin: 5px 0 10px;
          color: #8f9bb0;
          font-size: 10px;
          line-height: 1.5;
        }

        .tf-meta-panel {
          display: flex;
          flex-direction: column;
          gap: 7px;
          padding: 9px;
          margin-bottom: 10px;
          border-radius: 10px;
          background: rgba(2,6,23,0.38);
          border: 1px solid rgba(255,255,255,0.06);
        }

        .tf-meta-line {
          display: flex;
          gap: 7px;
          align-items: flex-start;
          color: #aeb9c9;
          font-size: 9px;
          line-height: 1.45;
        }

        .tf-meta-line strong {
          color: #e2e8f0;
        }

        .tf-prereq-list {
          color: #fbbf24;
        }

        .tf-link {
          border: none;
          background: transparent;
          color: #93c5fd;
          padding: 0;
          cursor: pointer;
          font-size: 9px;
          font-weight: 750;
          text-align: left;
        }

        .tf-edit-box {
          padding: 9px;
          margin-bottom: 9px;
          border-radius: 10px;
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.07);
        }

        .tf-mini-actions {
          display: flex;
          gap: 6px;
          margin-top: 7px;
        }

        .tf-mini-btn {
          border: none;
          border-radius: 7px;
          padding: 6px 9px;
          font-size: 9px;
          font-weight: 800;
          cursor: pointer;
        }

        .tf-status-section {
          padding-top: 10px;
          border-top: 1px solid rgba(255,255,255,0.06);
        }

        .tf-status-label {
          margin-bottom: 6px;
          color: #68768a;
          font-size: 8px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.65px;
        }

        .tf-status-buttons {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
        }

        .tf-status-button {
          border: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.035);
          color: #cbd5e1;
          border-radius: 7px;
          padding: 5px 7px;
          font-size: 8px;
          font-weight: 750;
          cursor: pointer;
        }

        .tf-status-button:hover {
          border-color: rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.06);
        }

        .tf-busy-overlay {
          position: fixed;
          inset: 0;
          z-index: 3000;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(2,6,23,0.48);
          backdrop-filter: blur(3px);
          -webkit-backdrop-filter: blur(3px);
          cursor: wait;
        }

        .tf-busy-card {
          min-width: 220px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          border-radius: 16px;
          background: rgba(17,20,32,0.96);
          border: 1px solid rgba(255,255,255,0.10);
          box-shadow: 0 25px 75px rgba(0,0,0,0.40);
        }

        .tf-spinner {
          width: 31px;
          height: 31px;
          border-radius: 50%;
          border: 4px solid rgba(255,255,255,0.16);
          border-top-color: #818cf8;
          animation: taskflowSpinner 0.75s linear infinite;
        }

        .tf-confirm-overlay {
          position: fixed;
          inset: 0;
          z-index: 3100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(2,6,23,0.68);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
        }

        .tf-confirm-card {
          width: min(420px, 100%);
          padding: 21px;
          border-radius: 17px;
          background:
            linear-gradient(
              180deg,
              #181b2b,
              #111420
            );
          border: 1px solid rgba(255,255,255,0.10);
          box-shadow: 0 28px 90px rgba(0,0,0,0.48);
        }

        .tf-confirm-icon {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
          border-radius: 11px;
          background: rgba(239,68,68,0.10);
          border: 1px solid rgba(239,68,68,0.18);
          color: #fb7185;
          font-size: 17px;
        }

        .tf-confirm-title {
          margin: 0 0 6px;
          color: #f8fafc;
          font-size: 17px;
          font-weight: 850;
        }

        .tf-confirm-text {
          margin: 0;
          color: #94a3b8;
          font-size: 11px;
          line-height: 1.6;
        }

        .tf-confirm-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 19px;
        }

        .tf-confirm-btn {
          border-radius: 9px;
          padding: 9px 12px;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
        }

        .tf-confirm-secondary {
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.05);
          color: #dbe4f0;
        }

        .tf-confirm-danger {
          border: none;
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: #fff;
        }

        @media (max-width: 1400px) {
          .tf-board-form {
            grid-template-columns:
              72px
              repeat(3, minmax(150px, 1fr))
              repeat(4, minmax(120px, 1fr));
          }

          .tf-board-form .tf-submit-field {
            grid-column: span 1;
          }
        }

        @media (max-width: 1100px) {
          .tf-board-form {
            grid-template-columns: repeat(3, minmax(145px, 1fr));
          }

          .tf-id-field-wrapper {
            grid-column: span 1;
          }

          .tf-submit-field {
            grid-column: span 1;
          }
        }

        @media (max-width: 700px) {
          .tf-board-form {
            grid-template-columns: 1fr;
          }

          .tf-columns {
            grid-template-columns:
              repeat(4, minmax(255px, 1fr));
          }
        }
      `}</style>

      {isBusy && (
        <div
          className="tf-busy-overlay"
          role="status"
          aria-live="polite"
        >
          <div className="tf-busy-card">
            <div className="tf-spinner" />

            <div
              style={{
                color: '#fff',
                fontSize: '12px',
                fontWeight: '800'
              }}
            >
              {busyMessage || 'Working...'}
            </div>

            <div
              style={{
                color: '#8f9bb0',
                fontSize: '10px'
              }}
            >
              Please wait...
            </div>
          </div>
        </div>
      )}

      {confirmation && (
        <div
          className="tf-confirm-overlay"
          role="dialog"
          aria-modal="true"
        >
          <div className="tf-confirm-card">
            <div className="tf-confirm-icon">
              ⚠
            </div>

            <h3 className="tf-confirm-title">
              {confirmation.type === 'clearAll'
                ? 'Clear All Tasks'
                : 'Delete Task'}
            </h3>

            <p className="tf-confirm-text">
              {confirmation.type === 'clearAll'
                ? 'Are you sure you want to delete all tasks? This action cannot be undone.'
                : `Are you sure you want to delete Task #${confirmation.taskId}? This action cannot be undone.`}
            </p>

            <div className="tf-confirm-actions">
              <button
                type="button"
                className="tf-confirm-btn tf-confirm-secondary"
                onClick={() => setConfirmation(null)}
                disabled={isBusy}
              >
                Cancel
              </button>

              <button
                type="button"
                className="tf-confirm-btn tf-confirm-danger"
                onClick={
                  confirmation.type === 'clearAll'
                    ? confirmClearAllTasks
                    : confirmDeleteTask
                }
                disabled={isBusy}
              >
                {confirmation.type === 'clearAll'
                  ? 'Clear All'
                  : 'Delete Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="tf-board-shell">
        <div className="tf-board-topbar">
          <div>
            <h2 className="tf-section-title">
              🚀 TaskFlow Pro Engine
            </h2>

            <p className="tf-section-subtitle">
              Dependency-aware Kanban workflow with DAG validation,
              scheduling, rollback handling, and persistent state.
            </p>
          </div>

          <div className="tf-action-row">
            <div className="tf-delete-group">
              <input
                className="tf-delete-input"
                type="number"
                min="1"
                placeholder="Task ID"
                value={deleteTaskId}
                onChange={(event) =>
                  setDeleteTaskId(event.target.value)
                }
              />

              <button
                type="button"
                style={dangerButtonStyle}
                onClick={handleDeleteById}
                disabled={isBusy}
              >
                Delete
              </button>
            </div>

            <button
              type="button"
              style={{
                ...dangerButtonStyle,
                padding: '9px 11px'
              }}
              onClick={requestClearAll}
              disabled={isBusy || tasks.length === 0}
            >
              Clear All
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="tf-error" role="alert">
            <div>
              <strong>⚠ Action could not be completed</strong>

              <div style={{ marginTop: '3px' }}>
                {errorMsg}
              </div>
            </div>

            <button
              type="button"
              className="tf-error-close"
              onClick={() => setErrorMsg('')}
              aria-label="Close error"
            >
              ×
            </button>
          </div>
        )}

        <form
          className="tf-board-form"
          onSubmit={handleCreate}
        >
          <div className="tf-field tf-id-field-wrapper">
            <label className="tf-field-label">
              Next ID
            </label>

            <div className="tf-id-value">
              #{nextTaskId || '—'}
            </div>
          </div>

          <div className="tf-field">
            <label
              className="tf-field-label"
              htmlFor="task-title"
            >
              Title *
            </label>

            <input
              id="task-title"
              style={inputStyle}
              type="text"
              placeholder="e.g. Design API contract"
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
              disabled={isBusy}
              maxLength={255}
            />
          </div>

          <div className="tf-field">
            <label
              className="tf-field-label"
              htmlFor="task-description"
            >
              Description
            </label>

            <input
              id="task-description"
              style={inputStyle}
              type="text"
              placeholder="Short task description"
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              disabled={isBusy}
            />
          </div>

          <div className="tf-field">
            <label
              className="tf-field-label"
              htmlFor="task-status"
            >
              Workflow
            </label>

            <select
              id="task-status"
              style={inputStyle}
              value={statusColumn}
              onChange={(event) =>
                setStatusColumn(event.target.value)
              }
              disabled={isBusy}
            >
              {WORKFLOW_COLUMNS.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </div>

          <div className="tf-field">
            <label
              className="tf-field-label"
              htmlFor="task-start-date"
            >
              Start Date *
            </label>

            <input
              id="task-start-date"
              style={inputStyle}
              type="date"
              value={startDate}
              onChange={(event) =>
                setStartDate(event.target.value)
              }
              disabled={isBusy}
            />
          </div>

          <div className="tf-field">
            <label
              className="tf-field-label"
              htmlFor="task-end-date"
            >
              End Date *
            </label>

            <input
              id="task-end-date"
              style={inputStyle}
              type="date"
              value={endDate}
              onChange={(event) =>
                setEndDate(event.target.value)
              }
              disabled={isBusy}
            />
          </div>

          <div className="tf-field">
            <label
              className="tf-field-label"
              htmlFor="task-prerequisites"
            >
              Prerequisites
            </label>

            <input
              id="task-prerequisites"
              style={inputStyle}
              type="text"
              placeholder="e.g. 1, 3, 5"
              value={prerequisiteInput}
              onChange={(event) =>
                setPrerequisiteInput(
                  event.target.value
                )
              }
              disabled={isBusy}
            />
          </div>

          <div className="tf-field tf-submit-field">
            <label className="tf-field-label">
              Action
            </label>

            <button
              type="submit"
              style={primaryButtonStyle}
              disabled={isBusy}
            >
              + Create Task
            </button>
          </div>
        </form>

        <div className="tf-columns">
          {safeColumns.map((column) => {
            const meta =
              COLUMN_META[column] ||
              COLUMN_META.Backlog;

            const columnTasks =
              groupedTasks[column] || [];

            return (
              <section
                key={column}
                className="tf-column"
                onDragOver={handleDragOver}
                onDrop={(event) =>
                  handleDrop(event, column)
                }
              >
                <div className="tf-column-header">
                  <div className="tf-column-heading">
                    <span
                      className="tf-column-icon"
                      style={{
                        color: meta.accent,
                        background: meta.soft,
                        border:
                          `1px solid ${meta.border}`
                      }}
                    >
                      {meta.icon}
                    </span>

                    <span>{column}</span>
                  </div>

                  <span className="tf-column-count">
                    {columnTasks.length}
                  </span>
                </div>

                {columnTasks.length === 0 ? (
                  <div className="tf-empty">
                    <div style={{ fontSize: '18px' }}>
                      {column === 'Backlog'
                        ? '📋'
                        : column === 'In Progress'
                        ? '⚙️'
                        : column === 'Review'
                        ? '🔍'
                        : '✅'}
                    </div>

                    <div>
                      Drop tasks here or create a new task.
                    </div>
                  </div>
                ) : (
                  columnTasks.map((task) => {
                    const taskId = getTaskId(task);
                    const dependencyStatus =
                      getDependencyStatus(task);

                    const dependencyMeta =
                      DEPENDENCY_META[
                        dependencyStatus
                      ];

                    const workflowStatus =
                      getWorkflowStatus(task);

                    const isEditingPrereq =
                      editingTaskId === taskId;

                    const isEditingDates =
                      editingDateTaskId === taskId;

                    return (
                      <article
                        key={taskId}
                        className="tf-task-card"
                        draggable={!isBusy}
                        onDragStart={(event) =>
                          handleDragStart(
                            event,
                            taskId
                          )
                        }
                      >
                        <div className="tf-task-header">
                          <div className="tf-badge-row">
                            <span className="tf-id-badge">
                              #{taskId}
                            </span>

                            <span
                              className="tf-status-badge"
                              style={{
                                color:
                                  dependencyMeta.accent,
                                background:
                                  dependencyMeta.soft,
                                border:
                                  `1px solid ${dependencyMeta.border}`
                              }}
                            >
                              {dependencyMeta.icon}{' '}
                              {dependencyStatus}
                            </span>
                          </div>

                          <button
                            type="button"
                            className="tf-card-delete"
                            onClick={() =>
                              requestDeleteTask(
                                taskId
                              )
                            }
                            disabled={isBusy}
                            aria-label={`Delete task ${taskId}`}
                            title="Delete task"
                          >
                            🗑
                          </button>
                        </div>

                        <h3 className="tf-task-title">
                          {task.title}
                        </h3>

                        {task.description && (
                          <p className="tf-task-description">
                            {task.description}
                          </p>
                        )}

                        <div className="tf-meta-panel">
                          <div className="tf-meta-line">
                            <span>📅</span>
                            <span>
                              <strong>Dates:</strong>{' '}
                              {formatDate(
                                task.start_date
                              )}{' '}
                              →{' '}
                              {formatDate(
                                task.end_date
                              )}
                            </span>
                          </div>

                          <div className="tf-meta-line">
                            <span>⛓</span>
                            <span>
                              <strong>Prerequisites:</strong>{' '}
                              <span className="tf-prereq-list">
                                {getPrerequisiteTitles(
                                  task
                                )}
                              </span>
                            </span>
                          </div>

                          <div className="tf-meta-line">
                            <span>📌</span>
                            <span>
                              <strong>Workflow:</strong>{' '}
                              {workflowStatus}
                            </span>
                          </div>
                        </div>

                        {isEditingPrereq && (
                          <div className="tf-edit-box">
                            <div
                              className="tf-field-label"
                              style={{
                                marginBottom: '6px'
                              }}
                            >
                              Edit Prerequisites
                            </div>

                            <input
                              style={inputStyle}
                              type="text"
                              placeholder="e.g. 1, 2, 4"
                              value={
                                editPrereqInput
                              }
                              onChange={(event) =>
                                setEditPrereqInput(
                                  event.target.value
                                )
                              }
                              disabled={isBusy}
                            />

                            <div className="tf-mini-actions">
                              <button
                                type="button"
                                className="tf-mini-btn"
                                style={{
                                  background:
                                    '#4f46e5'
                                }}
                                onClick={() =>
                                  handleUpdatePrerequisites(
                                    taskId
                                  )
                                }
                                disabled={isBusy}
                              >
                                Save
                              </button>

                              <button
                                type="button"
                                className="tf-mini-btn"
                                style={{
                                  background:
                                    'rgba(255,255,255,0.07)',
                                  color:
                                    '#cbd5e1'
                                }}
                                onClick={
                                  cancelPrerequisiteEdit
                                }
                                disabled={isBusy}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {isEditingDates && (
                          <div className="tf-edit-box">
                            <div
                              className="tf-field-label"
                              style={{
                                marginBottom: '6px'
                              }}
                            >
                              Edit Dates
                            </div>

                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns:
                                  '1fr 1fr',
                                gap: '7px'
                              }}
                            >
                              <input
                                style={inputStyle}
                                type="date"
                                value={
                                  editStartDate
                                }
                                onChange={(event) =>
                                  setEditStartDate(
                                    event.target.value
                                  )
                                }
                                disabled={isBusy}
                              />

                              <input
                                style={inputStyle}
                                type="date"
                                value={
                                  editEndDate
                                }
                                onChange={(event) =>
                                  setEditEndDate(
                                    event.target.value
                                  )
                                }
                                disabled={isBusy}
                              />
                            </div>

                            <div className="tf-mini-actions">
                              <button
                                type="button"
                                className="tf-mini-btn"
                                style={{
                                  background:
                                    '#4f46e5'
                                }}
                                onClick={() =>
                                  handleUpdateDates(
                                    taskId
                                  )
                                }
                                disabled={isBusy}
                              >
                                Save Dates
                              </button>

                              <button
                                type="button"
                                className="tf-mini-btn"
                                style={{
                                  background:
                                    'rgba(255,255,255,0.07)',
                                  color:
                                    '#cbd5e1'
                                }}
                                onClick={
                                  cancelDateEdit
                                }
                                disabled={isBusy}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {!isEditingPrereq &&
                          !isEditingDates && (
                            <div
                              style={{
                                display: 'flex',
                                gap: '8px',
                                marginBottom: '10px',
                                flexWrap: 'wrap'
                              }}
                            >
                              <button
                                type="button"
                                className="tf-link"
                                onClick={() =>
                                  beginPrerequisiteEdit(
                                    task
                                  )
                                }
                                disabled={isBusy}
                              >
                                ✎ Edit dependencies
                              </button>

                              <button
                                type="button"
                                className="tf-link"
                                onClick={() =>
                                  beginDateEdit(task)
                                }
                                disabled={isBusy}
                              >
                                ✎ Edit dates
                              </button>
                            </div>
                          )}

                        <div className="tf-status-section">
                          <div className="tf-status-label">
                            Move to workflow column
                          </div>

                          <div className="tf-status-buttons">
                            {WORKFLOW_COLUMNS.map(
                              (targetColumn) => {
                                const targetMeta =
                                  COLUMN_META[
                                    targetColumn
                                  ];

                                const active =
                                  workflowStatus ===
                                  targetColumn;

                                return (
                                  <button
                                    key={targetColumn}
                                    type="button"
                                    className="tf-status-button"
                                    onClick={() =>
                                      handleTaskMove(
                                        taskId,
                                        targetColumn
                                      )
                                    }
                                    disabled={
                                      isBusy ||
                                      active
                                    }
                                    style={
                                      active
                                        ? {
                                            color:
                                              targetMeta.accent,
                                            background:
                                              targetMeta.soft,
                                            border:
                                              `1px solid ${targetMeta.border}`
                                          }
                                        : undefined
                                    }
                                  >
                                    {targetMeta.icon}{' '}
                                    {targetColumn}
                                  </button>
                                );
                              }
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}