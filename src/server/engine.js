const db = require('./db');

/**
 * Convert an input into a positive integer.
 */
function toPositiveInteger(value) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    return null;
  }

  return number;
}

/**
 * Parse a YYYY-MM-DD date without timezone shifting.
 * PostgreSQL DATE values are also supported.
 */
function parseLocalDate(dateInput) {
  if (!dateInput) {
    return null;
  }

  let year;
  let month;
  let day;

  if (dateInput instanceof Date) {
    if (Number.isNaN(dateInput.getTime())) {
      return null;
    }

    year = dateInput.getUTCFullYear();
    month = dateInput.getUTCMonth();
    day = dateInput.getUTCDate();
  } else {
    const cleanString =
      typeof dateInput === 'string' && dateInput.includes('T')
        ? dateInput.split('T')[0]
        : dateInput;

    if (typeof cleanString !== 'string') {
      return null;
    }

    const parts = cleanString.split('-').map(Number);

    if (
      parts.length !== 3 ||
      parts.some((part) => !Number.isInteger(part))
    ) {
      return null;
    }

    [year, month, day] = parts;
    month -= 1;
  }

  const result = new Date(
    Date.UTC(year, month, day)
  );

  if (
    result.getUTCFullYear() !== year ||
    result.getUTCMonth() !== month ||
    result.getUTCDate() !== day
  ) {
    return null;
  }

  return result;
}

/**
 * Format a Date as YYYY-MM-DD.
 */
function formatLocalDate(dateObj) {
  if (
    !(dateObj instanceof Date) ||
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
}

/**
 * Add days to a date without timezone-related shifts.
 */
function addDays(dateObj, days) {
  const result = new Date(dateObj.getTime());

  result.setUTCDate(
    result.getUTCDate() + days
  );

  return result;
}

/**
 * Check whether adding:
 *
 *   prerequisite -> dependent
 *
 * would create a circular dependency.
 *
 * Existing graph remains untouched.
 */
async function wouldCreateCycle(
  pool,
  prerequisiteId,
  dependentId
) {
  const pId = toPositiveInteger(prerequisiteId);
  const dId = toPositiveInteger(dependentId);

  if (!pId || !dId) {
    return false;
  }

  if (pId === dId) {
    return true;
  }

  const depsRes = await pool.query(
    `
      SELECT
        prerequisite_task_id,
        dependent_task_id
      FROM dependencies
    `
  );

  const adjacency = new Map();

  for (const edge of depsRes.rows) {
    const parent = Number(
      edge.prerequisite_task_id
    );

    const child = Number(
      edge.dependent_task_id
    );

    if (!adjacency.has(parent)) {
      adjacency.set(parent, []);
    }

    adjacency.get(parent).push(child);
  }

  /**
   * Adding p -> d creates a cycle when
   * d can already reach p.
   *
   * So we start from d and traverse forward.
   */
  const visited = new Set();
  const stack = [dId];

  while (stack.length > 0) {
    const current = stack.pop();

    if (current === pId) {
      return true;
    }

    if (visited.has(current)) {
      continue;
    }

    visited.add(current);

    const neighbors =
      adjacency.get(current) || [];

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        stack.push(neighbor);
      }
    }
  }

  return false;
}

/**
 * Calculate task duration using the existing project's
 * convention:
 *
 * same-day task -> duration 1
 * different dates -> number of date differences
 *
 * Example:
 * 2026-10-01 -> 2026-10-03 = 2
 */
function calculateDuration(startDate, endDate) {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);

  if (!start || !end) {
    return 1;
  }

  const diffMilliseconds =
    end.getTime() - start.getTime();

  const diffDays = Math.round(
    diffMilliseconds / (1000 * 60 * 60 * 24)
  );

  return diffDays > 0 ? diffDays : 1;
}

/**
 * Collect all downstream descendants of a task.
 */
function collectDescendants(
  startTaskId,
  childrenMap
) {
  const descendants = new Set();
  const queue = [
    startTaskId
  ];

  while (queue.length > 0) {
    const currentId = queue.shift();

    const children =
      childrenMap.get(currentId) || [];

    for (const childId of children) {
      if (!descendants.has(childId)) {
        descendants.add(childId);
        queue.push(childId);
      }
    }
  }

  return descendants;
}

/**
 * Topologically sort only the affected downstream subgraph.
 *
 * This is important for converging/diamond dependency paths.
 * Every affected task is recomputed only after all of its
 * affected prerequisites have been processed.
 */
function topologicalSort(
  nodeIds,
  edges
) {
  const nodeSet = new Set(nodeIds);

  const indegree = new Map();
  const adjacency = new Map();

  for (const nodeId of nodeSet) {
    indegree.set(nodeId, 0);
    adjacency.set(nodeId, []);
  }

  for (const edge of edges) {
    const parent = Number(
      edge.prerequisite_task_id
    );

    const child = Number(
      edge.dependent_task_id
    );

    if (
      nodeSet.has(parent) &&
      nodeSet.has(child)
    ) {
      adjacency.get(parent).push(child);
      indegree.set(
        child,
        indegree.get(child) + 1
      );
    }
  }

  const queue = [];

  for (const nodeId of nodeSet) {
    if (indegree.get(nodeId) === 0) {
      queue.push(nodeId);
    }
  }

  const ordered = [];

  while (queue.length > 0) {
    const current = queue.shift();

    ordered.push(current);

    for (
      const childId of adjacency.get(current) || []
    ) {
      const nextDegree =
        indegree.get(childId) - 1;

      indegree.set(
        childId,
        nextDegree
      );

      if (nextDegree === 0) {
        queue.push(childId);
      }
    }
  }

  if (ordered.length !== nodeSet.size) {
    throw new Error(
      'Dependency graph contains a circular relationship.'
    );
  }

  return ordered;
}

/**
 * Recalculate downstream dates from the dependency graph.
 *
 * Important behavior:
 *
 * A dependent task starts one day after the latest
 * direct prerequisite ends.
 *
 * Dates are recomputed from the graph rather than
 * adding a delay once for every dependency path.
 *
 * Therefore:
 *
 *   A -> B -> D
 *   A -> C -> D
 *
 * does NOT cause D to receive the same A delay twice.
 */
async function propagateTaskDates(taskId) {
  const rootId = toPositiveInteger(taskId);

  if (!rootId) {
    throw new Error(
      'Task ID must be a positive integer.'
    );
  }

  const [
    tasksRes,
    depsRes
  ] = await Promise.all([
    db.query(
      `
        SELECT
          id,
          start_date,
          end_date,
          duration
        FROM tasks
      `
    ),
    db.query(
      `
        SELECT
          prerequisite_task_id,
          dependent_task_id
        FROM dependencies
      `
    )
  ]);

  const taskMap = new Map();

  for (const task of tasksRes.rows) {
    taskMap.set(
      Number(task.id),
      {
        id: Number(task.id),
        start_date: task.start_date,
        end_date: task.end_date,
        duration:
          Number(task.duration) > 0
            ? Number(task.duration)
            : 1
      }
    );
  }

  if (!taskMap.has(rootId)) {
    return;
  }

  const childrenMap = new Map();
  const parentsMap = new Map();

  for (const edge of depsRes.rows) {
    const parent = Number(
      edge.prerequisite_task_id
    );

    const child = Number(
      edge.dependent_task_id
    );

    if (!childrenMap.has(parent)) {
      childrenMap.set(parent, []);
    }

    childrenMap.get(parent).push(child);

    if (!parentsMap.has(child)) {
      parentsMap.set(child, []);
    }

    parentsMap.get(child).push(parent);
  }

  const affectedIds = collectDescendants(
    rootId,
    childrenMap
  );

  if (affectedIds.size === 0) {
    return;
  }

  const orderedIds = topologicalSort(
    affectedIds,
    depsRes.rows
  );

  for (const currentId of orderedIds) {
    const currentTask =
      taskMap.get(currentId);

    if (!currentTask) {
      continue;
    }

    const parentIds =
      parentsMap.get(currentId) || [];

    let latestPrerequisiteEnd = null;

    for (const parentId of parentIds) {
      const parentTask =
        taskMap.get(parentId);

      if (!parentTask || !parentTask.end_date) {
        continue;
      }

      const parentEnd =
        parseLocalDate(
          parentTask.end_date
        );

      if (
        parentEnd &&
        (
          !latestPrerequisiteEnd ||
          parentEnd >
            latestPrerequisiteEnd
        )
      ) {
        latestPrerequisiteEnd =
          parentEnd;
      }
    }

    if (!latestPrerequisiteEnd) {
      continue;
    }

    const newStartDate =
      addDays(
        latestPrerequisiteEnd,
        1
      );

    const duration =
      currentTask.duration > 0
        ? currentTask.duration
        : 1;

    const newEndDate =
      addDays(
        newStartDate,
        duration - 1
      );

    const formattedStart =
      formatLocalDate(
        newStartDate
      );

    const formattedEnd =
      formatLocalDate(
        newEndDate
      );

    await db.query(
      `
        UPDATE tasks
        SET
          start_date = $1,
          end_date = $2
        WHERE id = $3
      `,
      [
        formattedStart,
        formattedEnd,
        currentId
      ]
    );

    /**
     * Update the in-memory copy so a downstream
     * converging task uses the newly calculated
     * date from this task.
     */
    currentTask.start_date =
      formattedStart;

    currentTask.end_date =
      formattedEnd;
  }
}

/**
 * Calculate the dependency state of one task.
 *
 * This is derived state and is intentionally NOT stored
 * in status_column.
 *
 * Workflow column:
 *   Backlog / In Progress / Review / Done
 *
 * Dependency state:
 *   Ready / Blocked
 */
async function getDependencyState(taskId) {
  const id = toPositiveInteger(taskId);

  if (!id) {
    throw new Error(
      'Task ID must be a positive integer.'
    );
  }

  const result = await db.query(
    `
      SELECT
        t.id,
        t.status_column
      FROM dependencies d
      JOIN tasks t
        ON d.prerequisite_task_id = t.id
      WHERE d.dependent_task_id = $1
    `,
    [id]
  );

  /**
   * No prerequisites means nothing is blocking
   * the task.
   */
  if (result.rows.length === 0) {
    return 'Ready';
  }

  const blocked = result.rows.some(
    (prerequisite) =>
      prerequisite.status_column !== 'Done'
  );

  return blocked
    ? 'Blocked'
    : 'Ready';
}

/**
 * Recalculate dependency states for a task
 * and all of its downstream dependents.
 *
 * This function derives state from the graph.
 * It does NOT rewrite workflow columns.
 */
async function computeTaskStatus(taskId) {
  const rootId = toPositiveInteger(taskId);

  if (!rootId) {
    throw new Error(
      'Task ID must be a positive integer.'
    );
  }

  const depsRes = await db.query(
    `
      SELECT
        prerequisite_task_id,
        dependent_task_id
      FROM dependencies
    `
  );

  const childrenMap = new Map();

  for (const edge of depsRes.rows) {
    const parent = Number(
      edge.prerequisite_task_id
    );

    const child = Number(
      edge.dependent_task_id
    );

    if (!childrenMap.has(parent)) {
      childrenMap.set(parent, []);
    }

    childrenMap.get(parent).push(child);
  }

  const affected = new Set([
    rootId
  ]);

  const queue = [
    rootId
  ];

  while (queue.length > 0) {
    const currentId = queue.shift();

    const children =
      childrenMap.get(currentId) || [];

    for (const childId of children) {
      if (!affected.has(childId)) {
        affected.add(childId);
        queue.push(childId);
      }
    }
  }

  const results = [];

  for (const id of affected) {
    const dependencyState =
      await getDependencyState(id);

    results.push({
      taskId: id,
      dependencyStatus:
        dependencyState
    });
  }

  return results;
}

/**
 * Calculate dependency state for every task.
 *
 * Useful for the main GET /api/tasks endpoint
 * so the frontend receives:
 *
 *   status_column    -> workflow position
 *   dependencyStatus -> Ready / Blocked
 */
async function computeAllDependencyStates() {
  const [
    tasksRes,
    depsRes
  ] = await Promise.all([
    db.query(
      `
        SELECT
          id,
          status_column
        FROM tasks
      `
    ),
    db.query(
      `
        SELECT
          prerequisite_task_id,
          dependent_task_id
        FROM dependencies
      `
    )
  ]);

  const statusByTaskId = new Map();

  for (const task of tasksRes.rows) {
    statusByTaskId.set(
      Number(task.id),
      task.status_column
    );
  }

  const prerequisitesByTask =
    new Map();

  for (const dependency of depsRes.rows) {
    const dependentId =
      Number(
        dependency.dependent_task_id
      );

    const prerequisiteId =
      Number(
        dependency.prerequisite_task_id
      );

    if (
      !prerequisitesByTask.has(
        dependentId
      )
    ) {
      prerequisitesByTask.set(
        dependentId,
        []
      );
    }

    prerequisitesByTask
      .get(dependentId)
      .push(prerequisiteId);
  }

  return tasksRes.rows.map((task) => {
    const taskId = Number(task.id);

    const prerequisiteIds =
      prerequisitesByTask.get(taskId) || [];

    if (prerequisiteIds.length === 0) {
      return {
        taskId,
        dependencyStatus: 'Ready'
      };
    }

    const blocked =
      prerequisiteIds.some(
        (prerequisiteId) =>
          statusByTaskId.get(
            prerequisiteId
          ) !== 'Done'
      );

    return {
      taskId,
      dependencyStatus:
        blocked ? 'Blocked' : 'Ready'
    };
  });
}

module.exports = {
  wouldCreateCycle,
  propagateTaskDates,
  getDependencyState,
  computeTaskStatus,
  computeAllDependencyStates,
  calculateDuration,
  parseLocalDate,
  formatLocalDate
};