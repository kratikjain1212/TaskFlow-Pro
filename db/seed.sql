-- ============================================================
-- TaskFlow Pro Demo Seed Data
-- Intended for a fresh/demo PostgreSQL database only.
--
-- Workflow columns:
--   Backlog | In Progress | Review | Done
--
-- Dependency state (Ready / Blocked) is derived by the engine.
-- ============================================================

INSERT INTO tasks (
    id,
    title,
    description,
    status_column,
    start_date,
    end_date,
    duration
) VALUES

(
    1,
    'Requirements Gathering',
    'Collect and finalize project requirements.',
    'Done',
    '2026-09-26',
    '2026-09-27',
    2
),

(
    2,
    'Technical Planning',
    'Define technical approach, architecture, and implementation plan.',
    'Done',
    '2026-09-26',
    '2026-09-28',
    3
),

(
    3,
    'UI/UX Design',
    'Design the main TaskFlow Pro workflow and Kanban experience.',
    'In Progress',
    '2026-09-29',
    '2026-09-30',
    2
),

(
    4,
    'Database Design',
    'Design the task and dependency data model.',
    'Backlog',
    '2026-10-01',
    '2026-10-02',
    2
),

(
    5,
    'Backend API Development',
    'Implement task, status, date, and dependency APIs.',
    'Backlog',
    '2026-10-01',
    '2026-10-04',
    4
),

(
    6,
    'Frontend Integration',
    'Connect the frontend Kanban board with backend APIs.',
    'Backlog',
    '2026-10-05',
    '2026-10-07',
    3
),

(
    7,
    'Dependency Engine Testing',
    'Test cycle detection, blocking, rollback, and dependency propagation.',
    'Backlog',
    '2026-10-08',
    '2026-10-09',
    2
),

(
    8,
    'AI Dependency Suggestions',
    'Generate and review AI-assisted dependency suggestions.',
    'In Progress',
    '2026-09-29',
    '2026-10-01',
    3
),

(
    9,
    'Integration Testing',
    'Run end-to-end tests across tasks, dependencies, dates, and AI features.',
    'Backlog',
    '2026-10-10',
    '2026-10-11',
    2
),

(
    10,
    'Final Deployment',
    'Prepare and deploy the production-ready TaskFlow Pro application.',
    'Backlog',
    '2026-10-12',
    '2026-10-13',
    2
);

-- ============================================================
-- Dependency Graph
-- ============================================================
--
-- 1 -> 3
-- 2 -> 3
-- 3 -> 4
-- 3 -> 5
-- 4 -> 6
-- 5 -> 6
-- 6 -> 7
-- 2 -> 8
-- 7 -> 9
-- 8 -> 9
-- 9 -> 10
--
-- This intentionally contains branching and converging paths.
-- ============================================================

INSERT INTO dependencies (
    prerequisite_task_id,
    dependent_task_id
) VALUES
    (1, 3),
    (2, 3),
    (3, 4),
    (3, 5),
    (4, 6),
    (5, 6),
    (6, 7),
    (2, 8),
    (7, 9),
    (8, 9),
    (9, 10);

-- ============================================================
-- Synchronize PostgreSQL sequences after explicit seed IDs.
-- ============================================================

SELECT setval(
    pg_get_serial_sequence('tasks', 'id'),
    COALESCE(
        (SELECT MAX(id) FROM tasks),
        1
    ),
    true
);

SELECT setval(
    pg_get_serial_sequence('dependencies', 'id'),
    COALESCE(
        (SELECT MAX(id) FROM dependencies),
        1
    ),
    true
);