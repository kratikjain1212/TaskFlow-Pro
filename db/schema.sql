CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- Primary Kanban workflow column.
    -- Dependency state (Blocked / Ready) is derived by the engine.
    status_column VARCHAR(50) NOT NULL DEFAULT 'Backlog',

    start_date DATE,
    end_date DATE,
    duration INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dependencies (
    id SERIAL PRIMARY KEY,

    prerequisite_task_id INT NOT NULL
        REFERENCES tasks(id)
        ON DELETE CASCADE,

    dependent_task_id INT NOT NULL
        REFERENCES tasks(id)
        ON DELETE CASCADE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_task_dependency
        UNIQUE (
            prerequisite_task_id,
            dependent_task_id
        ),

    CONSTRAINT no_self_dependency
        CHECK (
            prerequisite_task_id <>
            dependent_task_id
        )
);

CREATE INDEX IF NOT EXISTS idx_dependencies_prerequisite
    ON dependencies(prerequisite_task_id);

CREATE INDEX IF NOT EXISTS idx_dependencies_dependent
    ON dependencies(dependent_task_id);