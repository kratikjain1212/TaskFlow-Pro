# TaskFlow Pro — Testing Guide

## 1. Testing Scope

This document records the functional and validation tests performed for TaskFlow Pro.

Testing covers:

- Task creation and validation
- Workflow status validation
- Dependency creation and updates
- Circular dependency prevention
- Duplicate dependency prevention
- Invalid dependency rejection
- Dependency rollback
- Dependency-based Ready/Blocked state calculation
- Date propagation
- Diamond/converging dependency paths
- Loading and error feedback
- Confirmation dialogs
- Database initialization and seed data
- Environment configuration
- AI dependency suggestions
- Persistence after refresh
- Build verification
- Security and repository hygiene checks

---

## 2. Test Environment

Functional testing was performed using:

- React + Vite frontend
- Node.js + Express backend
- PostgreSQL database
- OpenAI-powered dependency suggestion endpoint

Destructive database tests were performed against an isolated demo environment rather than a production database.

---

## 3. Workflow Model Tested

The primary Kanban workflow columns are:

- Backlog
- In Progress
- Review
- Done

`Blocked` and `Ready` are dependency states displayed separately from the workflow columns.

A task becomes:

- `Ready` when all prerequisites are in `Done`
- `Blocked` when at least one prerequisite is incomplete

---

## 4. Executed Test Cases

### TC-01 — Task Creation

**Purpose:** Verify that a user can create a valid task.

**Steps:**

1. Enter a task title.
2. Enter a description.
3. Select a valid workflow status.
4. Select start and end dates.
5. Select optional prerequisites.
6. Create the task.

**Expected Result:**

- Task is created successfully.
- Task receives a valid task ID.
- Task appears in the correct workflow column.
- Prerequisites are persisted.

**Result:** PASS

---

### TC-02 — Invalid Task Title

**Purpose:** Verify that tasks cannot be created without a title.

**Test Input:**

- Description provided
- Valid dates provided
- Empty or missing title

**Expected Result:**

- Request is rejected.
- No invalid task is created.
- API returns a clear validation error.

**Observed Result:**

- API returned `400 Bad Request`.
- Error reported that the task title is required.

**Result:** PASS

---

### TC-03 — Invalid Date Range

**Purpose:** Verify that a task cannot have an end date before its start date.

**Test Input:**

- Start date later than end date

**Expected Result:**

- Request is rejected.
- No invalid task is persisted.

**Result:** PASS

---

### TC-04 — Invalid Workflow Status

**Purpose:** Verify that unsupported workflow status values are rejected.

**Test Input:**

`InvalidStatus`

**Expected Result:**

- API returns a validation error.
- Only these workflow columns are accepted:
  - Backlog
  - In Progress
  - Review
  - Done

**Observed Result:**

- API returned `422 Unprocessable Entity`.
- Invalid status was rejected.

**Result:** PASS

---

### TC-05 — Missing Dependency Task

**Purpose:** Verify that dependencies cannot reference nonexistent tasks.

**Test Input:**

- Prerequisite task ID: `9999`
- Valid dependent task ID

**Expected Result:**

- Dependency creation is rejected.
- Existing valid dependency graph remains unchanged.

**Observed Result:**

- API returned `404 Not Found`.
- Error indicated that prerequisite task ID `9999` does not exist.

**Result:** PASS

---

### TC-06 — Self Dependency

**Purpose:** Verify that a task cannot depend on itself.

**Test Input:**

- `prerequisite_task_id = dependent_task_id`

**Expected Result:**

- Dependency creation is rejected.
- No self-loop is stored.

**Result:** PASS

---

### TC-07 — Circular Dependency

**Purpose:** Verify that adding a dependency that introduces a cycle is rejected.

**Steps:**

1. Create or use an existing valid dependency chain.
2. Attempt to add an edge that creates a cycle.

**Expected Result:**

- Dependency update is rejected.
- Existing valid dependency graph remains unchanged.

**Result:** PASS

---

### TC-08 — Duplicate Dependency

**Purpose:** Verify that the same prerequisite relationship cannot be stored twice.

**Expected Result:**

- Duplicate relationship is rejected.
- Only one valid dependency edge exists.

**Result:** PASS

---

### TC-09 — Dependency State Calculation

**Purpose:** Verify Ready and Blocked states.

**Test Data:**

Task 3 depends on Task 1 and Task 2.

**Steps:**

1. Leave at least one prerequisite incomplete.
2. Observe Task 3.
3. Mark all prerequisites as `Done`.
4. Observe Task 3 again.

**Expected Result:**

- Task 3 is `Blocked` while any prerequisite is incomplete.
- Task 3 becomes `Ready` when all prerequisites are `Done`.

**Result:** PASS

---

### TC-10 — Dependency Rollback

**Purpose:** Verify that downstream dependency state is recalculated when a prerequisite moves backward.

**Steps:**

1. Complete all prerequisites of a dependent task.
2. Confirm the dependent task is `Ready`.
3. Move one prerequisite from `Done` to an incomplete workflow state.
4. Observe the dependent task.

**Expected Result:**

- The dependent task becomes `Blocked`.
- Downstream dependency state is recalculated from the current graph.

**Result:** PASS

---

### TC-11 — Date Propagation

**Purpose:** Verify that changing a task schedule propagates to affected downstream tasks.

**Steps:**

1. Change the dates of a prerequisite task.
2. Save the new dates.
3. Observe dependent tasks.

**Observed Test:**

- Date changes were successfully applied through the UI.
- Dates remained correct after page refresh.
- PostgreSQL `DATE` values were preserved without timezone-related one-day shifts.

**Expected Result:**

- Downstream tasks are recalculated.
- Task durations remain preserved.
- Dates remain stable after refresh.

**Result:** PASS

---

### TC-12 — Diamond / Converging Dependency Paths

**Purpose:** Verify that the same upstream delay is not counted multiple times through converging paths.

**Dependency Pattern:**

Task A -> Task B -> Task D

Task A -> Task C -> Task D

**Expected Result:**

- Task D should receive the effective upstream delay once.
- The delay must not be doubled simply because Task D is reachable through two paths.

**Observed Result:**

- The upstream delay was applied once rather than being double-counted.

**Result:** PASS

---

### TC-13 — Loading Feedback

**Purpose:** Verify that users receive visual feedback while backend operations are running.

**Steps:**

1. Trigger a task operation.
2. Observe the interface during the request.

**Expected Result:**

- Loading feedback is displayed.
- The user receives clear progress feedback.
- Duplicate interaction is prevented while the request is in progress.

**Result:** PASS

---

### TC-14 — Error Feedback

**Purpose:** Verify that failed backend operations produce a clear user-facing error.

**Steps:**

1. Attempt an operation against a nonexistent task ID such as `9999`.
2. Observe the interface.

**Expected Result:**

- Operation fails safely.
- A clear error message is displayed.
- The application remains usable.

**Result:** PASS

---

### TC-15 — Confirmation Dialog

**Purpose:** Verify that destructive operations require confirmation.

**Actions Covered:**

- Delete Task
- Clear All Tasks

**Expected Result:**

- Application-level confirmation dialog appears.
- User can cancel the operation.
- Cancel leaves the data unchanged.
- Confirm performs the requested destructive action.

**Result:** PASS

---

## 5. Database Setup Tests

### TC-16 — Database Initialization

**Purpose:** Verify that a fresh PostgreSQL database can be initialized from repository files.

**Command:**

    npm run db:setup

**Expected Result:**

- Database schema is applied successfully.
- Required task and dependency tables are created.
- Dependency constraints are created.
- Demo seed data is loaded into an empty database.

**Observed Result:**

- Schema setup completed successfully.
- Demo tasks and dependencies were inserted successfully.

**Result:** PASS

---

### TC-17 — Seed Data

**Purpose:** Verify that the repository contains reproducible demo data.

**Expected Result:**

- The seed file creates a realistic workflow.
- Tasks contain meaningful titles and descriptions.
- Dependency relationships create a usable DAG for testing.

**Result:** PASS

---

## 6. Persistence Test

### TC-18 — Refresh Persistence

**Purpose:** Verify that task state survives application refresh.

**Steps:**

1. Change a task's workflow status.
2. Change a task's prerequisites or dates.
3. Refresh the browser.

**Expected Result:**

- Updated state is loaded from PostgreSQL.
- Workflow and dependency state remain consistent.

**Result:** PASS

---

## 7. AI Testing

### TC-19 — AI Dependency Suggestions

**Purpose:** Verify that the application can request AI-assisted dependency suggestions.

**Steps:**

1. Configure a valid `OPENAI_API_KEY`.
2. Open the AI suggestion feature.
3. Request dependency suggestions.

**Expected Result:**

- Suggestions are returned when the AI service is available.
- Suggestions contain task relationships that can be reviewed by the user.

**Result:** PASS

---

### TC-20 — Human Approval for AI Suggestions

**Purpose:** Verify that AI suggestions do not directly modify the dependency graph.

**Steps:**

1. Generate an AI suggestion.
2. Review the suggestion.
3. Accept or dismiss it.
4. If accepted, send it to the backend.

**Expected Result:**

- AI suggestions are presented for human review.
- Dismissed suggestions are not persisted.
- Accepted suggestions are sent to the backend.
- Backend dependency validation is applied before persistence.

**Result:** PASS

---

### TC-21 — Invalid AI/API Error Handling

**Purpose:** Verify that AI service failures are handled safely.

**Expected Result:**

- API or configuration errors are shown to the user.
- The board does not crash.
- Existing tasks and dependencies remain usable.

**Result:** PASS

---

## 8. Build Verification

### TC-22 — Production Frontend Build

**Command:**

    npm run build

**Expected Result:**

- Vite completes the production build without errors.
- Frontend assets are generated in `dist`.

**Observed Result:**

- Vite build completed successfully.
- 26 modules were transformed.
- No build errors occurred.

**Result:** PASS

---

## 9. Security and Repository Hygiene Checks

The following checks were performed before public repository preparation:

- `.env` is excluded from version control.
- `.env.example` contains placeholders only.
- Real credentials are not intended for the public repository.
- `node_modules` is excluded from the final public repository.
- `dist` is excluded from the final public repository.
- No private certificates or keys should be committed.
- No production database credentials should be committed.
- No obvious dangerous command execution patterns were found in the application source during the security review.

Dependency audit result:

    npm audit --audit-level=high

Result:

    found 0 vulnerabilities

---

## 10. Final Verification Before Public Submission

The following checks should be completed after the clean public repository has been created.

### TV-01 — Clean Repository Verification

Verify that the public repository contains source and documentation files only.

Confirm that the repository does not contain:

- `.env`
- API keys
- Database passwords
- `node_modules`
- Unnecessary build artifacts
- Private certificates
- Large generated files

---

### TV-02 — Fresh Clone Verification

From a clean environment:

1. Clone the public repository.
2. Run `npm install`.
3. Create a PostgreSQL database.
4. Create `.env` from `.env.example`.
5. Add the user's own `DATABASE_URL`.
6. Add the user's own `OPENAI_API_KEY`.
7. Run `npm run db:setup`.
8. Run `npm run build`.
9. Run `npm start`.
10. Open the application.
11. Verify the main workflow and dependency features.

**Expected Result:**

The project should start successfully from the public repository using user-provided environment configuration.

---

### TV-03 — Dependency Integrity Verification

On the clean repository:

- Create a valid dependency.
- Attempt a self-dependency.
- Attempt a duplicate dependency.
- Attempt a nonexistent dependency.
- Attempt a circular dependency.
- Attempt an invalid prerequisite update.

**Expected Result:**

Invalid dependency changes are rejected and the existing valid graph remains intact.

---

### TV-04 — Scheduling Verification

Verify:

- Direct downstream date propagation
- Multi-level propagation
- Rollback behavior
- Diamond/converging dependency behavior
- No double-counting of the same upstream delay
- Duration preservation
- Date persistence after refresh

---

### TV-05 — AI Verification

With a valid OpenAI API key:

- Request suggestions.
- Review the suggested relationships.
- Dismiss a suggestion.
- Accept a valid suggestion.
- Confirm backend validation is applied.

---

### TV-06 — Production Deployment Verification

After deployment:

- Verify the live application loads.
- Verify backend API responses.
- Verify the production database connection.
- Verify task creation and updates.
- Verify dependency validation.
- Verify date propagation.
- Verify AI suggestions with production environment variables.

---

## 11. Known Testing Limitations

- Current functional tests were performed in a controlled demo environment.
- Fresh-machine verification should be repeated against the final public repository.
- Production deployment verification should be completed after deployment.
- AI behavior can vary depending on the configured model/service response.
- Manual testing does not replace a full automated test suite.

---

## 12. Final Testing Status

Core application behavior tested locally:

- Task creation: PASS
- Task validation: PASS
- Workflow validation: PASS
- Dependency creation: PASS
- Invalid dependency rejection: PASS
- Circular dependency rejection: PASS
- Duplicate dependency rejection: PASS
- Dependency rollback: PASS
- Ready/Blocked calculation: PASS
- Date propagation: PASS
- Diamond/no-compounding scheduling: PASS
- Persistence after refresh: PASS
- Loading feedback: PASS
- Error feedback: PASS
- Confirmation dialogs: PASS
- Database setup: PASS
- AI suggestion flow: PASS
- AI human-in-the-loop flow: PASS
- Production build: PASS
- Dependency audit: PASS

Final clean-repository, fresh-clone, and deployment checks should be recorded here after completion.

---

## 13. Test Conclusion

TaskFlow Pro has been manually validated against the core workflow, dependency, scheduling, persistence, AI, and validation scenarios required for the project.

The final public submission should be accompanied by the clean repository verification and fresh-environment checks described above.