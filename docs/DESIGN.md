# TaskFlow Pro — Architecture & Design

## 1. Overview

TaskFlow Pro is a dependency-aware workflow and DAG scheduling engine.

The system combines:

- A React-based Kanban board
- An Express.js backend
- PostgreSQL persistence
- Dependency validation and DAG cycle detection
- Automatic downstream date propagation
- AI-assisted dependency suggestions with human approval

The backend is the source of truth for task dependencies, workflow validation, and scheduling calculations.

---

## 2. System Architecture

The application has three main layers.

### Frontend

Technology:

- React
- Vite
- JavaScript
- HTML/CSS

Responsibilities:

- Display tasks in workflow columns
- Show dependency state as `Blocked` or `Ready`
- Create, edit, move, and delete tasks
- Manage prerequisite relationships
- Request AI dependency suggestions
- Allow the user to accept or dismiss AI suggestions
- Refresh task data from the backend

### Backend

Technology:

- Node.js
- Express.js

Responsibilities:

- Validate task data
- Validate workflow status changes
- Validate dependency relationships
- Prevent invalid and cyclic dependency graphs
- Calculate dependency state
- Propagate scheduling dates through the dependency graph
- Persist all valid changes
- Provide AI dependency suggestion endpoints

### Database

Technology:

- PostgreSQL

The database stores:

- Tasks
- Dependency relationships

Foreign keys and database constraints are used to protect dependency integrity.

---

## 3. Workflow Model

The primary Kanban workflow columns are:

1. Backlog
2. In Progress
3. Review
4. Done

`Blocked` and `Ready` are dependency states, not primary Kanban columns.

A task is:

- `Ready` when all of its prerequisites are satisfied
- `Blocked` when at least one prerequisite is incomplete

The dependency state is derived from the prerequisite relationships and their current workflow status.

---

## 4. Task Data Model

Each task contains:

- `id`
- `title`
- `description`
- `status_column`
- `start_date`
- `end_date`
- `duration`
- `created_at`

`status_column` is restricted to:

- `Backlog`
- `In Progress`
- `Review`
- `Done`

Dates are stored as PostgreSQL `DATE` values.

---

## 5. Dependency Data Model

Dependencies are represented as directed edges:

`Prerequisite Task -> Dependent Task`

Example:

`Task A -> Task B`

means Task B depends on Task A.

The database stores:

- `prerequisite_task_id`
- `dependent_task_id`
- `created_at`

A unique constraint prevents duplicate dependency edges.

A check constraint prevents self-dependencies.

---

## 6. DAG Validation

Task dependencies form a directed graph.

Before a new dependency is saved, the backend validates the resulting graph.

The system rejects:

- Self-dependencies
- Dependencies referencing nonexistent tasks
- Duplicate dependency edges
- Dependencies that would create a cycle

For prerequisite updates, validation happens before replacing the existing dependency set.

Therefore, an invalid update does not partially modify a previously valid graph.

---

## 7. Dependency State Calculation

Dependency state is derived rather than stored as the workflow column.

For a task with no prerequisites:

`Ready`

For a task with prerequisites:

- All prerequisites in `Done` -> `Ready`
- At least one prerequisite not in `Done` -> `Blocked`

This keeps workflow state and dependency state conceptually separate.

---

## 8. Scheduling and Date Propagation

Tasks have a start date, end date, and duration.

When a prerequisite changes, downstream tasks are recalculated.

For each affected dependent task:

`Dependent Start = Latest Direct Prerequisite End + 1 day`

The task's existing duration is preserved while its dates are shifted.

Propagation continues through all affected descendants in dependency order.

---

## 9. No-Compounding Dependency Paths

The scheduling engine avoids double-counting the same upstream delay when multiple dependency paths converge.

Example:

Task A -> Task B -> Task D

Task A -> Task C -> Task D

Task D should not receive the same upstream delay twice simply because Task A reaches it through two paths.

The engine processes the affected graph in topological order and calculates each task from its direct prerequisites.

This prevents compounding delays in converging or diamond-shaped dependency graphs.

---

## 10. Rollback Behavior

If a prerequisite is moved backward in the workflow, downstream dependency state is recalculated.

Example:

Task A -> Task B -> Task C

If Task A is moved from `Done` back to an incomplete workflow state, Task B and downstream tasks that depend on it can become `Blocked`.

This recalculation is based on the current dependency graph and current task statuses.

---

## 11. Persistence

Task and dependency changes are persisted in PostgreSQL.

The application supports persistence for:

- Task creation
- Task deletion
- Workflow status changes
- Date changes
- Dependency updates

Refreshing the application reloads the persisted state from the backend.

Dependency records are configured with cascading deletion when a referenced task is deleted.

---

## 12. AI-Assisted Dependency Suggestions

TaskFlow Pro includes an AI-assisted dependency suggestion feature.

The AI uses task information such as:

- Task title
- Task description

to suggest potentially relevant prerequisite relationships.

The AI is not the source of truth.

The workflow is:

Task data
↓
AI suggestion
↓
Human review
↓
Accept or dismiss
↓
Backend dependency validation
↓
Database persistence

When a user accepts an AI suggestion, the request is sent through the same backend dependency validation used for normal dependency creation.

Therefore, the AI cannot bypass:

- Missing-task validation
- Duplicate dependency validation
- Self-dependency validation
- Cycle detection

---

## 13. API Responsibilities

Important backend endpoints include:

### Tasks

`GET /api/tasks`

Returns the current task list and prerequisite information.

`POST /api/tasks`

Creates a validated task.

`PUT /api/tasks/:id/status`

Validates and updates workflow status.

`PUT /api/tasks/:id/dates`

Updates task dates and propagates downstream scheduling changes.

`PUT /api/tasks/:id/prerequisites`

Validates and replaces prerequisite relationships.

`DELETE /api/tasks/:id`

Deletes a task.

### Dependencies

`POST /api/dependencies`

Creates a validated dependency edge.

### AI

`GET /api/ai/suggest`

Requests AI-generated dependency suggestions for human review.

---

## 14. Security and Configuration

Secrets are provided through environment variables.

Examples include:

- `DATABASE_URL`
- `OPENAI_API_KEY`

Sensitive environment files such as `.env` are excluded from version control.

The public repository should contain only `.env.example` with placeholder values.

No API keys, passwords, certificates, or production credentials should be committed to the repository.

---

## 15. Key Assumptions

- A prerequisite is considered satisfied when its workflow status is `Done`.
- Scheduling uses inclusive task duration.
- A dependent task starts after the latest direct prerequisite finishes.
- Dependency state is derived from the current graph and task statuses.
- AI suggestions require human approval before a dependency is created.

---

## 16. Known Limitations

- AI suggestions depend on availability and quality of the configured OpenAI service.
- The AI may produce suggestions that are not useful or applicable; users must review them before acceptance.
- The current application is designed as a project/demo workflow engine rather than a full enterprise project-management platform.
- Authentication and role-based access control are not implemented in the current version.
- Large-scale distributed scheduling and multi-user conflict resolution are outside the current scope.

---

## 17. Design Principles

TaskFlow Pro follows these principles:

1. The backend is the source of truth.
2. Invalid dependency changes must never corrupt a valid graph.
3. Workflow state and dependency state remain separate concepts.
4. Scheduling propagation should be deterministic.
5. AI assists the user but does not bypass validation.
6. Persistent database state should survive application refreshes.