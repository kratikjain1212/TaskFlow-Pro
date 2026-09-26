const express = require('express');
const cors = require('cors');
const path = require('path');
const OpenAI = require('openai');

require('dotenv').config();

const db = require('./db');

const {
  wouldCreateCycle,
  propagateTaskDates,
  computeTaskStatus
} = require('./engine');

const app = express();

const PORT = process.env.PORT || 5001;

const ALLOWED_STATUSES = [
  'Backlog',
  'In Progress',
  'Review',
  'Done'
];

app.use(express.json());

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173'
  })
);

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  : null;

/* ============================================================
   DATE HELPERS
   ============================================================ */

const parseLocalDate = (dateInput) => {
  if (!dateInput) return null;

  let cleanStr;

  if (dateInput instanceof Date) {
    if (Number.isNaN(dateInput.getTime())) {
      return null;
    }

    cleanStr = dateInput.toISOString().split('T')[0];
  } else {
    cleanStr =
      typeof dateInput === 'string'
        ? dateInput.split('T')[0]
        : null;
  }

  if (!cleanStr) {
    return null;
  }

  const parts = cleanStr.split('-').map(Number);

  if (
    parts.length !== 3 ||
    parts.some(Number.isNaN)
  ) {
    return null;
  }

  const [year, month, day] = parts;

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  );
};

const formatLocalDate = (dateObj) => {
  if (
    !dateObj ||
    Number.isNaN(dateObj.getTime())
  ) {
    return null;
  }

  const year = dateObj.getUTCFullYear();

  const month = String(
    dateObj.getUTCMonth() + 1
  ).padStart(2, '0');

  const day = String(
    dateObj.getUTCDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const calculateDuration = (
  startDateStr,
  endDateStr
) => {
  const start = parseLocalDate(startDateStr);
  const end = parseLocalDate(endDateStr);

  if (!start || !end) {
    return 1;
  }

  const diffDays = Math.round(
    (end - start) /
      (1000 * 60 * 60 * 24)
  );

  return diffDays >= 0
    ? diffDays + 1
    : 1;
};

/* ============================================================
   VALIDATION HELPERS
   ============================================================ */

const normalizePrerequisiteIds = (ids) => {
  if (ids === undefined || ids === null) {
    return [];
  }

  if (!Array.isArray(ids)) {
    return null;
  }

  const normalized = ids.map(Number);

  if (
    normalized.some(
      (id) =>
        !Number.isInteger(id) ||
        id <= 0
    )
  ) {
    return null;
  }

  const uniqueIds = [
    ...new Set(normalized)
  ];

  if (
    uniqueIds.length !== normalized.length
  ) {
    return null;
  }

  return uniqueIds;
};

const isValidTaskId = (id) => {
  return (
    Number.isInteger(id) &&
    id > 0
  );
};

const getExistingTaskIds = async (ids) => {
  if (ids.length === 0) {
    return new Set();
  }

  const result = await db.query(
    `
    SELECT id
    FROM tasks
    WHERE id = ANY($1::int[])
    `,
    [ids]
  );

  return new Set(
    result.rows.map((row) =>
      Number(row.id)
    )
  );
};

/* ============================================================
   SAFE CYCLE CHECK FOR PREREQUISITE REPLACEMENT
   ============================================================ */

const wouldCreateCycleForReplacement = async (
  taskId,
  prerequisiteIds
) => {
  if (prerequisiteIds.length === 0) {
    return false;
  }

  const result = await db.query(
    `
    SELECT
      prerequisite_task_id,
      dependent_task_id
    FROM dependencies
    `
  );

  const graph = new Map();

  const addEdge = (from, to) => {
    if (!graph.has(from)) {
      graph.set(from, new Set());
    }

    graph.get(from).add(to);
  };

  for (const row of result.rows) {
    const prerequisiteId = Number(
      row.prerequisite_task_id
    );

    const dependentId = Number(
      row.dependent_task_id
    );

    // The existing incoming edges of this task
    // are about to be replaced.
    if (dependentId === taskId) {
      continue;
    }

    addEdge(
      prerequisiteId,
      dependentId
    );
  }

  const canReach = (
    startId,
    targetId
  ) => {
    const visited = new Set();
    const stack = [startId];

    while (stack.length > 0) {
      const current = stack.pop();

      if (current === targetId) {
        return true;
      }

      if (visited.has(current)) {
        continue;
      }

      visited.add(current);

      const nextNodes =
        graph.get(current);

      if (!nextNodes) {
        continue;
      }

      for (const nextId of nextNodes) {
        if (!visited.has(nextId)) {
          stack.push(nextId);
        }
      }
    }

    return false;
  };

  return prerequisiteIds.some(
    (prerequisiteId) =>
      canReach(
        taskId,
        prerequisiteId
      )
  );
};

/* ============================================================
   GET ALL TASKS
   ============================================================ */

app.get('/api/tasks', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        t.*,
        COALESCE(
          array_agg(
            d.prerequisite_task_id
          )
          FILTER (
            WHERE d.prerequisite_task_id IS NOT NULL
          ),
          '{}'
        ) AS prerequisite_ids
      FROM tasks t
      LEFT JOIN dependencies d
        ON t.id = d.dependent_task_id
      GROUP BY t.id
      ORDER BY t.id ASC;
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(
      'Error fetching tasks:',
      err
    );

    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

/* ============================================================
   GET NEXT TASK ID
   ============================================================ */

app.get(
  '/api/tasks/next-id',
  async (req, res) => {
    try {
      const result = await db.query(`
        SELECT
          last_value,
          is_called
        FROM tasks_id_seq
      `);

      const row = result.rows[0];

      const nextId = row.is_called
        ? Number(row.last_value) + 1
        : Number(row.last_value);

      res.json({
        nextId
      });
    } catch (err) {
      console.error(
        'Error fetching next ID:',
        err
      );

      res.status(500).json({
        error: 'Internal server error.'
      });
    }
  }
);

/* ============================================================
   DELETE TASK
   ============================================================ */

app.delete(
  '/api/tasks/:id',
  async (req, res) => {
    const taskId = Number(
      req.params.id
    );

    if (!isValidTaskId(taskId)) {
      return res.status(400).json({
        error: 'Invalid task ID.'
      });
    }

    try {
      const result = await db.query(
        `
        DELETE FROM tasks
        WHERE id = $1
        RETURNING *
        `,
        [taskId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Task not found'
        });
      }

      res.json({
        message:
          'Task successfully deleted!'
      });
    } catch (err) {
      console.error(
        'Delete task error:',
        err
      );

      res.status(500).json({
        error: 'Internal server error.'
      });
    }
  }
);

/* ============================================================
   CREATE TASK
   ============================================================ */

app.post(
  '/api/tasks',
  async (req, res) => {
    const {
      title,
      description,
      status_column,
      start_date,
      end_date,
      prerequisite_ids
    } = req.body;

    try {
      if (
        typeof title !== 'string' ||
        title.trim().length === 0
      ) {
        return res.status(400).json({
          error: 'Invalid title',
          message:
            'Task title is required.'
        });
      }

      if (!start_date || !end_date) {
        return res.status(422).json({
          error: 'Missing dates',
          message:
            'Start date and end date are required.'
        });
      }

      if (
        status_column !== undefined &&
        !ALLOWED_STATUSES.includes(
          status_column
        )
      ) {
        return res.status(422).json({
          error: 'Invalid status',
          message:
            'Status must be Backlog, In Progress, Review, or Done.'
        });
      }

      const prerequisiteIds =
        normalizePrerequisiteIds(
          prerequisite_ids
        );

      if (prerequisiteIds === null) {
        return res.status(422).json({
          error:
            'Invalid prerequisite',
          message:
            'Prerequisite IDs must be positive integers without duplicates.'
        });
      }

      const hasPrerequisites =
        prerequisiteIds.length > 0;

      const startDate =
        parseLocalDate(start_date);

      const endDate =
        parseLocalDate(end_date);

      if (!startDate || !endDate) {
        return res.status(422).json({
          error: 'Invalid dates',
          message:
            'Start date and end date must be valid dates.'
        });
      }

      if (startDate > endDate) {
        return res.status(422).json({
          error:
            'Invalid Date Range',
          message:
            'Start date cannot be after the end date.'
        });
      }

      if (hasPrerequisites) {
        const existingIds =
          await getExistingTaskIds(
            prerequisiteIds
          );

        const missingIds =
          prerequisiteIds.filter(
            (id) =>
              !existingIds.has(id)
          );

        if (missingIds.length > 0) {
          return res.status(422).json({
            error:
              'Invalid prerequisite',
            message:
              `Prerequisite task ID${missingIds.length > 1 ? 's' : ''} ${missingIds.join(', ')} do not exist. Task creation rejected.`
          });
        }

        const prereqDates =
          await db.query(
            `
            SELECT
              id,
              title,
              end_date,
              status_column
            FROM tasks
            WHERE id = ANY($1::int[])
            `,
            [prerequisiteIds]
          );

        let maxPrereqEndDate = null;

        for (const prereq of prereqDates.rows) {
          if (!prereq.end_date) {
            continue;
          }

          const prereqEnd =
            parseLocalDate(
              prereq.end_date
            );

          if (!prereqEnd) {
            continue;
          }

          if (
            !maxPrereqEndDate ||
            prereqEnd > maxPrereqEndDate
          ) {
            maxPrereqEndDate =
              prereqEnd;
          }
        }

        if (
          maxPrereqEndDate &&
          startDate <= maxPrereqEndDate
        ) {
          return res.status(422).json({
            error:
              'Validation Blocked',
            message:
              `Task start date cannot be on or before its prerequisites' end date (${formatLocalDate(maxPrereqEndDate)}).`
          });
        }

        if (
          status_column &&
          status_column !== 'Backlog'
        ) {
          const unmetPrerequisites =
            prereqDates.rows.filter(
              (prereq) =>
                prereq.status_column !==
                'Done'
            );

          if (
            unmetPrerequisites.length > 0
          ) {
            const titles =
              unmetPrerequisites
                .map(
                  (prereq) =>
                    `"${prereq.title}" (ID: ${prereq.id})`
                )
                .join(', ');

            return res.status(422).json({
              error:
                'Prerequisites not met',
              message:
                `A task with incomplete prerequisites must start in Backlog. Unmet prerequisites: ${titles}`
            });
          }
        }
      }

      const initialStatus =
        status_column || 'Backlog';

      const duration =
        calculateDuration(
          start_date,
          end_date
        );

      const insertResult =
        await db.query(
          `
          INSERT INTO tasks
            (
              title,
              description,
              status_column,
              start_date,
              end_date,
              duration
            )
          VALUES
            ($1, $2, $3, $4, $5, $6)
          RETURNING *
          `,
          [
            title.trim(),
            description?.trim() || null,
            initialStatus,
            start_date,
            end_date,
            duration
          ]
        );

      const newTask =
        insertResult.rows[0];

      try {
        for (const prerequisiteId of prerequisiteIds) {
          const cycle =
            await wouldCreateCycle(
              db,
              prerequisiteId,
              newTask.id
            );

          if (cycle) {
            await db.query(
              `
              DELETE FROM tasks
              WHERE id = $1
              `,
              [newTask.id]
            );

            return res.status(422).json({
              error: 'Cycle detected',
              message:
                `Adding prerequisite ID ${prerequisiteId} creates a circular loop. Task creation rejected.`
            });
          }

          await db.query(
            `
            INSERT INTO dependencies
              (
                prerequisite_task_id,
                dependent_task_id
              )
            VALUES
              ($1, $2)
            `,
            [
              prerequisiteId,
              newTask.id
            ]
          );
        }
      } catch (dependencyError) {
        await db.query(
          `
          DELETE FROM tasks
          WHERE id = $1
          `,
          [newTask.id]
        );

        throw dependencyError;
      }

      if (hasPrerequisites) {
        await propagateTaskDates(
          newTask.id
        );

        await computeTaskStatus(
          newTask.id
        );
      }

      const finalTaskResult =
        await db.query(
          `
          SELECT
            t.*,
            COALESCE(
              array_agg(
                d.prerequisite_task_id
              )
              FILTER (
                WHERE d.prerequisite_task_id IS NOT NULL
              ),
              '{}'
            ) AS prerequisite_ids
          FROM tasks t
          LEFT JOIN dependencies d
            ON t.id = d.dependent_task_id
          WHERE t.id = $1
          GROUP BY t.id
          `,
          [newTask.id]
        );

      res.status(201).json(
        finalTaskResult.rows[0]
      );
    } catch (err) {
      console.error(
        'Error creating task:',
        err
      );

      res.status(500).json({
        error:
          'Internal server error.'
      });
    }
  }
);

/* ============================================================
   UPDATE TASK DATES
   ============================================================ */

app.put(
  '/api/tasks/:id/dates',
  async (req, res) => {
    const taskId = Number(
      req.params.id
    );

    const {
      start_date,
      end_date
    } = req.body;

    if (!isValidTaskId(taskId)) {
      return res.status(400).json({
        error: 'Invalid task ID.'
      });
    }

    try {
      const taskResult =
        await db.query(
          `
          SELECT id
          FROM tasks
          WHERE id = $1
          `,
          [taskId]
        );

      if (
        taskResult.rows.length === 0
      ) {
        return res.status(404).json({
          error: 'Task not found'
        });
      }

      if (!start_date || !end_date) {
        return res.status(422).json({
          error: 'Missing dates',
          message:
            'Start date and end date are required.'
        });
      }

      const startDate =
        parseLocalDate(start_date);

      const endDate =
        parseLocalDate(end_date);

      if (!startDate || !endDate) {
        return res.status(422).json({
          error: 'Invalid dates',
          message:
            'Start date and end date must be valid dates.'
        });
      }

      if (startDate > endDate) {
        return res.status(422).json({
          error:
            'Invalid Date Range',
          message:
            'Start date cannot be after the end date.'
        });
      }

      const prereqResult =
        await db.query(
          `
          SELECT
            t.id,
            t.title,
            t.end_date
          FROM dependencies d
          JOIN tasks t
            ON d.prerequisite_task_id = t.id
          WHERE d.dependent_task_id = $1
          `,
          [taskId]
        );

      let maxPrereqEndDate = null;
      let blockingPrereq = null;

      for (
        const prerequisite
        of prereqResult.rows
      ) {
        if (!prerequisite.end_date) {
          continue;
        }

        const prerequisiteEnd =
          parseLocalDate(
            prerequisite.end_date
          );

        if (!prerequisiteEnd) {
          continue;
        }

        if (
          !maxPrereqEndDate ||
          prerequisiteEnd >
            maxPrereqEndDate
        ) {
          maxPrereqEndDate =
            prerequisiteEnd;

          blockingPrereq =
            prerequisite;
        }
      }

      if (
        maxPrereqEndDate &&
        startDate <= maxPrereqEndDate
      ) {
        return res.status(422).json({
          error:
            'Validation Blocked',
          message:
            `Cannot set start date to ${start_date}. This task depends on "${blockingPrereq.title}" (ID: ${blockingPrereq.id}) which ends on ${blockingPrereq.end_date}.`
        });
      }

      const duration =
        calculateDuration(
          start_date,
          end_date
        );

      await db.query(
        `
        UPDATE tasks
        SET
          start_date = $1,
          end_date = $2,
          duration = $3
        WHERE id = $4
        `,
        [
          start_date,
          end_date,
          duration,
          taskId
        ]
      );

      await propagateTaskDates(
        taskId
      );

      const updatedTask =
        await db.query(
          `
          SELECT
            t.*,
            COALESCE(
              array_agg(
                d.prerequisite_task_id
              )
              FILTER (
                WHERE d.prerequisite_task_id IS NOT NULL
              ),
              '{}'
            ) AS prerequisite_ids
          FROM tasks t
          LEFT JOIN dependencies d
            ON t.id = d.dependent_task_id
          WHERE t.id = $1
          GROUP BY t.id
          `,
          [taskId]
        );

      res.json({
        message:
          'Dates updated and propagated successfully!',
        task: updatedTask.rows[0]
      });
    } catch (err) {
      console.error(
        'Date update error:',
        err
      );

      res.status(500).json({
        error:
          'Internal server error.'
      });
    }
  }
);

/* ============================================================
   UPDATE TASK PREREQUISITES
   ============================================================ */

app.put(
  '/api/tasks/:id/prerequisites',
  async (req, res) => {
    const taskId = Number(
      req.params.id
    );

    if (!isValidTaskId(taskId)) {
      return res.status(400).json({
        error: 'Invalid task ID.'
      });
    }

    const prerequisiteIds =
      normalizePrerequisiteIds(
        req.body.prerequisite_ids
      );

    if (prerequisiteIds === null) {
      return res.status(422).json({
        error:
          'Invalid prerequisite',
        message:
          'Prerequisite IDs must be positive integers without duplicates.'
      });
    }

    try {
      const taskResult =
        await db.query(
          `
          SELECT
            id,
            start_date
          FROM tasks
          WHERE id = $1
          `,
          [taskId]
        );

      if (
        taskResult.rows.length === 0
      ) {
        return res.status(404).json({
          error: 'Task not found'
        });
      }

      if (
        prerequisiteIds.includes(
          taskId
        )
      ) {
        return res.status(422).json({
          error: 'Cycle detected',
          message:
            `Task ID ${taskId} cannot be its own prerequisite. Update rejected.`
        });
      }

      const existingIds =
        await getExistingTaskIds(
          prerequisiteIds
        );

      const missingIds =
        prerequisiteIds.filter(
          (id) =>
            !existingIds.has(id)
        );

      if (missingIds.length > 0) {
        return res.status(422).json({
          error:
            'Invalid prerequisite',
          message:
            `Prerequisite task ID${missingIds.length > 1 ? 's' : ''} ${missingIds.join(', ')} do not exist. Update rejected.`
        });
      }

      if (
        prerequisiteIds.length > 0 &&
        taskResult.rows[0].start_date
      ) {
        const prereqDates =
          await db.query(
            `
            SELECT
              id,
              title,
              end_date
            FROM tasks
            WHERE id = ANY($1::int[])
            `,
            [prerequisiteIds]
          );

        let maxPrereqEndDate =
          null;

        let blockingPrereq = null;

        for (
          const prerequisite
          of prereqDates.rows
        ) {
          if (!prerequisite.end_date) {
            continue;
          }

          const prerequisiteEnd =
            parseLocalDate(
              prerequisite.end_date
            );

          if (!prerequisiteEnd) {
            continue;
          }

          if (
            !maxPrereqEndDate ||
            prerequisiteEnd >
              maxPrereqEndDate
          ) {
            maxPrereqEndDate =
              prerequisiteEnd;

            blockingPrereq =
              prerequisite;
          }
        }

        const taskStartDate =
          parseLocalDate(
            taskResult.rows[0]
              .start_date
          );

        if (
          maxPrereqEndDate &&
          taskStartDate &&
          taskStartDate <=
            maxPrereqEndDate
        ) {
          return res.status(422).json({
            error:
              'Validation Blocked',
            message:
              `Cannot update prerequisites. This task's start date is on or before prerequisite "${blockingPrereq.title}" (ID: ${blockingPrereq.id}).`
          });
        }
      }

      /*
       * IMPORTANT:
       * Validate the complete proposed graph BEFORE
       * removing the existing dependencies.
       */
      const createsCycle =
        await wouldCreateCycleForReplacement(
          taskId,
          prerequisiteIds
        );

      if (createsCycle) {
        return res.status(422).json({
          error: 'Cycle detected',
          message:
            'Updating these prerequisites creates a circular loop. Update rejected.'
        });
      }

      await db.query(
        `
        DELETE FROM dependencies
        WHERE dependent_task_id = $1
        `,
        [taskId]
      );

      for (
        const prerequisiteId
        of prerequisiteIds
      ) {
        await db.query(
          `
          INSERT INTO dependencies
            (
              prerequisite_task_id,
              dependent_task_id
            )
          VALUES
            ($1, $2)
          `,
          [
            prerequisiteId,
            taskId
          ]
        );
      }

      await propagateTaskDates(
        taskId
      );

      await computeTaskStatus(
        taskId
      );

      const updatedTask =
        await db.query(
          `
          SELECT
            t.*,
            COALESCE(
              array_agg(
                d.prerequisite_task_id
              )
              FILTER (
                WHERE d.prerequisite_task_id IS NOT NULL
              ),
              '{}'
            ) AS prerequisite_ids
          FROM tasks t
          LEFT JOIN dependencies d
            ON t.id = d.dependent_task_id
          WHERE t.id = $1
          GROUP BY t.id
          `,
          [taskId]
        );

      res.json({
        message:
          'Prerequisites updated successfully!',
        task:
          updatedTask.rows[0]
      });
    } catch (err) {
      console.error(
        'Update prerequisites error:',
        err
      );

      res.status(500).json({
        error:
          'Internal server error.'
      });
    }
  }
);

/* ============================================================
   UPDATE TASK WORKFLOW STATUS
   ============================================================ */

app.put(
  '/api/tasks/:id/status',
  async (req, res) => {
    const taskId = Number(
      req.params.id
    );

    const {
      status_column
    } = req.body;

    if (!isValidTaskId(taskId)) {
      return res.status(400).json({
        error: 'Invalid task ID.'
      });
    }

    if (
      !ALLOWED_STATUSES.includes(
        status_column
      )
    ) {
      return res.status(422).json({
        error: 'Invalid status',
        message:
          'Status must be Backlog, In Progress, Review, or Done.'
      });
    }

    try {
      const taskResult =
        await db.query(
          `
          SELECT
            id,
            title,
            status_column
          FROM tasks
          WHERE id = $1
          `,
          [taskId]
        );

      if (
        taskResult.rows.length === 0
      ) {
        return res.status(404).json({
          error:
            'Task not found'
        });
      }

      /*
       * Backlog is always allowed.
       *
       * Moving into In Progress, Review,
       * or Done requires all prerequisites
       * to be Done.
       */
      if (
        status_column !== 'Backlog'
      ) {
        const prereqResult =
          await db.query(
            `
            SELECT
              t.id,
              t.title,
              t.status_column
            FROM dependencies d
            JOIN tasks t
              ON d.prerequisite_task_id = t.id
            WHERE d.dependent_task_id = $1
            `,
            [taskId]
          );

        const unmetPrereqs =
          prereqResult.rows.filter(
            (prerequisite) =>
              prerequisite.status_column !==
              'Done'
          );

        if (
          unmetPrereqs.length > 0
        ) {
          const unmetTitles =
            unmetPrereqs
              .map(
                (prerequisite) =>
                  `"${prerequisite.title}" (ID: ${prerequisite.id})`
              )
              .join(', ');

          return res.status(422).json({
            error:
              'Prerequisites not met',
            message:
              `Cannot move task to ${status_column}. Complete these prerequisites first: ${unmetTitles}`
          });
        }
      }

      const result =
        await db.query(
          `
          UPDATE tasks
          SET status_column = $1
          WHERE id = $2
          RETURNING *
          `,
          [
            status_column,
            taskId
          ]
        );

      await computeTaskStatus(
        taskId
      );

      const finalTaskResult =
        await db.query(
          `
          SELECT
            t.*,
            COALESCE(
              array_agg(
                d.prerequisite_task_id
              )
              FILTER (
                WHERE d.prerequisite_task_id IS NOT NULL
              ),
              '{}'
            ) AS prerequisite_ids
          FROM tasks t
          LEFT JOIN dependencies d
            ON t.id = d.dependent_task_id
          WHERE t.id = $1
          GROUP BY t.id
          `,
          [taskId]
        );

      res.json({
        message:
          'Status updated successfully',
        task:
          finalTaskResult.rows[0]
      });
    } catch (err) {
      console.error(
        'Status update error:',
        err
      );

      res.status(500).json({
        error:
          'Internal server error.'
      });
    }
  }
);

/* ============================================================
   AI DEPENDENCY SUGGESTIONS
   ============================================================ */

app.get(
  '/api/ai/suggest',
  async (req, res) => {
    if (!openai) {
      return res.status(503).json({
        error:
          'AI service unavailable',
        message:
          'OPENAI_API_KEY is not configured.'
      });
    }

    try {
      const tasksResult =
        await db.query(
          `
          SELECT
            id,
            title,
            description,
            status_column,
            start_date,
            end_date
          FROM tasks
          ORDER BY id ASC
          `
        );

      const tasks =
        tasksResult.rows;

      if (tasks.length === 0) {
        return res.json([]);
      }

      const prompt = `
You are assisting with project workflow planning.

Analyze the following tasks and suggest logical prerequisite relationships.

A prerequisite task must be completed before the dependent task can proceed.

Tasks:
${JSON.stringify(tasks, null, 2)}

Return ONLY a JSON object with this structure:

{
  "suggestions": [
    {
      "taskId": 10,
      "suggestedPrerequisiteId": 4,
      "reason": "Task 4 should be completed before Task 10 because..."
    }
  ]
}

Rules:
- Do not suggest self-dependencies.
- Do not suggest relationships that obviously create circular dependencies.
- Prefer meaningful workflow relationships.
- Do not invent task IDs.
- Keep reasons concise.
`;

      const completion =
        await openai.chat.completions.create(
          {
            model:
              'gpt-4o-mini',
            messages: [
              {
                role: 'user',
                content: prompt
              }
            ],
            response_format: {
              type: 'json_object'
            }
          }
        );

      const content =
        completion
          .choices?.[0]
          ?.message
          ?.content;

      if (!content) {
        return res.status(502).json({
          error:
            'AI service returned an empty response.'
        });
      }

      const parsed =
        JSON.parse(content);

      const suggestions =
        Array.isArray(
          parsed?.suggestions
        )
          ? parsed.suggestions
          : [];

      /*
       * AI is NOT the source of truth.
       * Only suggestions are returned.
       * Accepted suggestions go through
       * /api/dependencies where backend
       * validation checks IDs, duplicates,
       * self-dependencies and cycles.
       */
      res.json(suggestions);
    } catch (err) {
      console.error(
        'AI suggestion error:',
        err
      );

      res.status(500).json({
        error:
          'AI suggestion request failed.'
      });
    }
  }
);

/* ============================================================
   ADD SINGLE DEPENDENCY
   ============================================================ */

app.post(
  '/api/dependencies',
  async (req, res) => {
    const prerequisiteTaskId =
      Number(
        req.body
          .prerequisite_task_id
      );

    const dependentTaskId =
      Number(
        req.body
          .dependent_task_id
      );

    if (
      !isValidTaskId(
        prerequisiteTaskId
      ) ||
      !isValidTaskId(
        dependentTaskId
      )
    ) {
      return res.status(422).json({
        error:
          'Invalid dependency',
        message:
          'Task IDs must be positive integers.'
      });
    }

    if (
      prerequisiteTaskId ===
      dependentTaskId
    ) {
      return res.status(422).json({
        error:
          'Cycle detected',
        message:
          'A task cannot depend on itself. Request rejected.'
      });
    }

    try {
      const taskResult =
        await db.query(
          `
          SELECT id
          FROM tasks
          WHERE id = ANY($1::int[])
          `,
          [
            [
              prerequisiteTaskId,
              dependentTaskId
            ]
          ]
        );

      const existingIds =
        new Set(
          taskResult.rows.map(
            (row) =>
              Number(row.id)
          )
        );

      const missingIds = [
        prerequisiteTaskId,
        dependentTaskId
      ].filter(
        (id) =>
          !existingIds.has(id)
      );

      if (missingIds.length > 0) {
        return res.status(422).json({
          error:
            'Invalid dependency',
          message:
            `Task ID${missingIds.length > 1 ? 's' : ''} ${missingIds.join(', ')} do not exist.`
        });
      }

      const duplicateResult =
        await db.query(
          `
          SELECT id
          FROM dependencies
          WHERE
            prerequisite_task_id = $1
            AND dependent_task_id = $2
          `,
          [
            prerequisiteTaskId,
            dependentTaskId
          ]
        );

      if (
        duplicateResult.rows.length >
        0
      ) {
        return res.status(409).json({
          error:
            'Dependency already exists',
          message:
            'This dependency is already configured.'
        });
      }

      const cycle =
        await wouldCreateCycle(
          db,
          prerequisiteTaskId,
          dependentTaskId
        );

      if (cycle) {
        return res.status(422).json({
          error:
            'Cycle detected',
          message:
            'Adding this dependency creates a circular loop. Request rejected.'
        });
      }

      const result =
        await db.query(
          `
          INSERT INTO dependencies
            (
              prerequisite_task_id,
              dependent_task_id
            )
          VALUES
            ($1, $2)
          RETURNING *
          `,
          [
            prerequisiteTaskId,
            dependentTaskId
          ]
        );

      await propagateTaskDates(
        dependentTaskId
      );

      await computeTaskStatus(
        dependentTaskId
      );

      res.status(201).json({
        message:
          'Dependency added successfully',
        dependency:
          result.rows[0]
      });
    } catch (err) {
      console.error(
        'Dependency creation error:',
        err
      );

      res.status(500).json({
        error:
          'Internal server error.'
      });
    }
  }
);

/* ============================================================
   SERVE FRONTEND
   ============================================================ */

const rootPath = path.join(
  __dirname,
  '../../dist'
);

app.use(
  express.static(rootPath)
);

app.get(
  /^(?!\/api).*/,
  (req, res) => {
    res.sendFile(
      path.join(
        rootPath,
        'index.html'
      )
    );
  }
);

/* ============================================================
   START SERVER
   ============================================================ */

app.listen(
  PORT,
  () => {
    console.log(
      `Server is running smoothly on port ${PORT}`
    );
  }
);