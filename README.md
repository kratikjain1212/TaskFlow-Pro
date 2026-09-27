**# TaskFlow Pro**



TaskFlow Pro is a dependency-aware workflow and DAG scheduling engine designed to manage tasks with prerequisites, validate dependency relationships, and automatically propagate scheduling changes through downstream tasks.



**## Overview**



TaskFlow Pro combines a Kanban workflow with a dependency graph.



A task can depend on one or more prerequisite tasks. The application determines whether a task is \`Ready\` or \`Blocked\` based on the completion state of its prerequisites.



The system also supports automatic downstream date propagation, DAG cycle detection, dependency validation, persistent PostgreSQL storage, and AI-assisted dependency suggestions.



**## Core Features**



**### Kanban Workflow**



The primary workflow columns are:



\- Backlog

\- In Progress

\- Review

\- Done



\`Blocked\` and \`Ready\` are dependency states displayed separately from the workflow columns.



**### Dependency Management**



Tasks can have one or more prerequisite tasks.



The backend validates dependency changes and rejects:



\- Self-dependencies

\- Nonexistent task references

\- Duplicate dependencies

\- Circular dependencies



Invalid dependency updates are rejected before the existing valid dependency graph is replaced.



**### DAG Scheduling**



Task dependencies are represented as a directed acyclic graph.



When a prerequisite changes, affected downstream tasks are recalculated in dependency order.



The scheduling engine:



\- Preserves task duration

\- Calculates downstream start dates from prerequisite completion

\- Propagates changes through descendants

\- Avoids double-counting delays in converging or diamond-shaped dependency paths



**### Dependency State**



A task without prerequisites is \`Ready\`.



A task with prerequisites is:



\- \`Ready\` when all prerequisites are \`Done\`

\- \`Blocked\` when at least one prerequisite is not \`Done\`



Dependency state is derived from the current task statuses and dependency graph.



**### Persistence**



Task and dependency changes are stored in PostgreSQL.



The application persists:



\- Task creation

\- Task deletion

\- Workflow status changes

\- Date changes

\- Dependency changes



Application refreshes reload the persisted state from the backend.



**### AI-Assisted Dependency Suggestions**



TaskFlow Pro includes an AI-assisted dependency suggestion feature.



The AI uses task information such as titles and descriptions to suggest potentially relevant prerequisite relationships.



AI suggestions are not automatically written to the database.



The user reviews each suggestion and can accept or dismiss it.



Accepted suggestions are sent through the backend dependency API, where the normal validation rules are applied before the dependency is stored.



This keeps the backend DAG engine as the source of truth.



**## Technology Stack**



**### Frontend**



\- React

\- Vite

\- JavaScript

\- HTML

\- CSS



**### Backend**



\- Node.js

\- Express.js



**### Database**



\- PostgreSQL



**### AI**



\- OpenAI API



**## Project Structure**



&#x20;   taskflow-pro/

&#x20;   ├── db/

&#x20;   │   ├── schema.sql

&#x20;   │   └── seed.sql

&#x20;   ├── docs/

&#x20;   │   ├── DESIGN.md

&#x20;   │   └── TESTING.md

&#x20;   ├── scripts/

&#x20;   │   └── setup-db.js

&#x20;   ├── src/

&#x20;   │   ├── client/

&#x20;   │   │   ├── components/

&#x20;   │   │   │   ├── AISuggestionModal.jsx

&#x20;   │   │   │   ├── KanbanBoard.jsx

&#x20;   │   │   │   └── TaskCard.jsx

&#x20;   │   │   ├── App.css

&#x20;   │   │   ├── App.jsx

&#x20;   │   │   └── main.jsx

&#x20;   │   └── server/

&#x20;   │       ├── aiSuggest.js

&#x20;   │       ├── db.js

&#x20;   │       ├── engine.js

&#x20;   │       └── server.js

&#x20;   ├── .env.example

&#x20;   ├── .gitignore

&#x20;   ├── index.html

&#x20;   ├── package.json

&#x20;   ├── package-lock.json

&#x20;   └── README.md



**## Requirements**



Before running TaskFlow Pro, install the following:



\- Node.js (18+ recommended)

\- npm

\- PostgreSQL



You will also need:



\- A PostgreSQL database

\- An OpenAI API key for the AI dependency suggestion feature



**## Getting Started**



Follow these steps to run TaskFlow Pro from a fresh GitHub clone.



**### 1. Clone the Repository**



Clone the public GitHub repository:



&#x20;   git clone \<YOUR_PUBLIC_GITHUB_REPOSITORY_URL>



Move into the project directory:



&#x20;   cd taskflow-pro



**### 2. Install Dependencies**



Install all project dependencies:



&#x20;   npm install



**### 3. Configure PostgreSQL**



TaskFlow Pro uses PostgreSQL for persistent task and dependency storage.



Create or use a PostgreSQL database and obtain its connection string.



The connection string normally follows this format:



&#x20;   postgresql://USERNAME:PASSWORD\@HOST:PORT/DATABASE



For a local PostgreSQL installation, an example can look like:



&#x20;   postgresql://postgres:your_password\@localhost:5432/taskflow_pro



Do not copy the example credentials above. Replace them with your own PostgreSQL username, password, host, port, and database name.



**### 4. Configure Environment Variables**



Create a \`.env\` file in the project root.



Use \`.env.example\` as the template.



Add your own configuration:



&#x20;   PORT=5001

&#x20;   DATABASE_URL=your_postgresql_connection_string

&#x20;   OPENAI_API_KEY=your_openai_api_key

&#x20;   VITE_API_URL=http\://localhost:5001



Replace:



\- \`DATABASE_URL\` with your PostgreSQL connection string.

\- \`OPENAI_API_KEY\` with your own OpenAI API key.



The OpenAI API key is required to use the AI dependency suggestion feature.



Do not commit \`.env\` to GitHub.



The repository contains \`.env.example\` only as a configuration template.



**### 5. Initialize the Database**



After configuring \`DATABASE_URL\`, run:



&#x20;   npm run db:setup



This command:



1\. Applies the PostgreSQL schema.

2\. Creates the required tables and dependency constraints.

3\. Loads the demo seed data.

4\. Inserts the initial realistic workflow tasks and dependency relationships.



**### 6. Build the Frontend**



Create the production frontend build:



&#x20;   npm run build



This generates the frontend files in the local \`dist\` directory.



The \`dist\` directory is intentionally excluded from Git because it is generated from the source code.



**### 7. Start the Application**



For local development:



&#x20;   npm run dev



The backend server starts on port \`5001\` by default.



Open:



&#x20;   http\://localhost:5001



For a production-style local run:



&#x20;   npm run build

&#x20;   npm start



Then open:



&#x20;   http\://localhost:5001



**### 8. Verify the Application**



After opening the application, verify that:



\- The Kanban board loads successfully.

\- The four workflow columns are visible:

&#x20; \- Backlog

&#x20; \- In Progress

&#x20; \- Review

&#x20; \- Done

\- Tasks show \`Blocked\` or \`Ready\` dependency states.

\- Demo tasks and dependencies are visible.

\- Task creation works.

\- Workflow status changes persist after refresh.

\- Dependency changes are validated.

\- Date changes propagate to downstream tasks.

\- AI dependency suggestions can be requested when \`OPENAI_API_KEY\` is configured.



**### Environment Variable Summary**



&#x20;   PORT=5001

&#x20;   DATABASE_URL=your_postgresql_connection_string

&#x20;   OPENAI_API_KEY=your_openai_api_key

&#x20;   VITE_API_URL=http\://localhost:5001



**### Important Security Notes**



Never commit:



\- \`.env\`

\- Real OpenAI API keys

\- PostgreSQL passwords

\- Database connection strings containing real credentials

\- Private certificates or private keys



The public repository should contain only \`.env.example\` with placeholder values.



**### Troubleshooting**



If \`npm run db:setup\` fails:



1\. Check that PostgreSQL is running.

2\. Check that \`DATABASE_URL\` is correct.

3\. Confirm that the specified database exists.

4\. Confirm that the PostgreSQL user has permission to create and modify tables.



If the application loads but AI suggestions fail:



1\. Check that \`OPENAI_API_KEY\` is present in \`.env\`.

2\. Verify that the key is valid and active.

3\. Restart the application after changing \`.env\`.



If the application does not load after cloning:



1\. Run \`npm install\`.

2\. Run \`npm run db:setup\`.

3\. Run \`npm run build\`.

4\. Run \`npm run dev\`.

5\. Open \`http\://localhost:5001\`.



**## Important API Endpoints**



**### Tasks**



&#x20;   GET /api/tasks



Returns the current tasks and prerequisite information.



&#x20;   POST /api/tasks



Creates a new task after validation.



&#x20;   PUT /api/tasks/:id/status



Updates the workflow status of a task.



&#x20;   PUT /api/tasks/:id/dates



Updates task dates and propagates downstream scheduling changes.



&#x20;   PUT /api/tasks/:id/prerequisites



Validates and updates the prerequisite relationships for a task.



&#x20;   DELETE /api/tasks/:id



Deletes a task.



**### Dependencies**



&#x20;   POST /api/dependencies



Creates a new dependency after backend validation.



**### AI**



&#x20;   GET /api/ai/suggest



Generates AI-assisted dependency suggestions for human review.



**## Validation Rules**



The backend prevents invalid workflow and dependency operations.



Examples include:



\- Invalid workflow status values are rejected.

\- A task cannot depend on itself.

\- Dependencies referencing nonexistent tasks are rejected.

\- Duplicate dependency edges are rejected.

\- Circular dependency creation is rejected.

\- Tasks with incomplete prerequisites cannot be incorrectly treated as dependency-ready.

\- Invalid date ranges are rejected.

\- Accepted AI dependency suggestions go through the same backend validation as normal dependencies.



**## Scheduling Rules**



For an affected dependent task:



&#x20;   Dependent Start = Latest Direct Prerequisite End + 1 day



The task's duration is preserved during propagation.



The scheduling engine processes affected descendants in dependency order.



For converging dependency paths, the same upstream delay is not counted multiple times simply because the dependent task is reachable through more than one path.



**## AI Tool Declaration**



TaskFlow Pro uses the OpenAI API to generate dependency suggestions based on task information such as task titles and descriptions.



AI is used as an assistant for proposing potentially useful dependency relationships.



AI does not directly modify the dependency graph.



A human must accept a suggestion before it is submitted to the backend, and the backend validates the accepted relationship before persistence.



The deterministic DAG engine remains the source of truth for dependency correctness.



**## Security**



The project follows basic security and repository hygiene practices:



\- Secrets are stored in environment variables.

\- \`.env\` is excluded from version control.

\- \`.env.example\` contains placeholders only.

\- No API keys, passwords, certificates, or production credentials should be committed.

\- Dependency folders such as \`node_modules\` are excluded from the public repository.

\- Build artifacts such as \`dist\` are generated locally and should not be treated as source code.



**## Documentation**



Architecture and design details are documented in:



&#x20;   docs/DESIGN.md



Testing and validation details are documented in:



&#x20;   docs/TESTING.md



**## Testing**



The application has been manually validated for important workflow and dependency behaviors, including:



\- Task creation

\- Task deletion

\- Workflow status validation

\- Dependency creation

\- Invalid dependency rejection

\- Duplicate dependency rejection

\- Circular dependency rejection

\- Dependency rollback behavior

\- Date propagation

\- Diamond/converging dependency paths

\- Persistence after refresh

\- AI suggestion flow

\- AI suggestion acceptance

\- Invalid AI/API error handling



The detailed test documentation is available in:



&#x20;   docs/TESTING.md



**## Known Limitations**



\- Authentication and role-based access control are not implemented.

\- Multi-user conflict resolution is outside the current scope.

\- Large-scale distributed scheduling is outside the current project scope.

\- AI suggestions depend on the availability and quality of the configured OpenAI service.

\- AI suggestions require human review and may not always be appropriate.

\- The current application is intended as a project/demo workflow engine rather than a complete enterprise project-management platform.



**## Project Goal**



TaskFlow Pro demonstrates how a traditional task board can be extended with dependency-aware scheduling and graph-based validation.



The main design goals are:



1\. Keep dependency correctness deterministic.

2\. Prevent invalid DAG updates.

3\. Recalculate downstream schedules automatically.

4\. Avoid compounding delays across converging dependency paths.

5\. Keep AI suggestions under human control.

6\. Persist workflow state reliably in PostgreSQL.

7\. Keep the architecture simple enough to extend.



**## Author**



Kratik Jain