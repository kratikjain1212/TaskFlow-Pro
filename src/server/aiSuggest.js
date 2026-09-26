const OpenAI = require('openai');

const MODEL =
  process.env.OPENAI_MODEL || 'gpt-4o-mini';

/**
 * Create the OpenAI client only when the API key exists.
 * This allows the application server to start normally
 * even when AI configuration has not been provided yet.
 */
function createOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

/**
 * Normalize and validate AI-generated suggestions.
 *
 * The AI is allowed to suggest relationships, but the
 * dependency endpoint remains the final authority for
 * cycle detection and persistence.
 */
function normalizeSuggestions(
  rawSuggestions,
  tasks
) {
  if (!Array.isArray(rawSuggestions)) {
    return [];
  }

  const taskIds = new Set(
    tasks.map((task) => Number(task.id))
  );

  const existingDependencies =
    new Set();

  for (const task of tasks) {
    const dependentId =
      Number(task.id);

    const prerequisiteIds =
      Array.isArray(task.prerequisite_ids)
        ? task.prerequisite_ids
        : [];

    for (
      const prerequisiteId
      of prerequisiteIds
    ) {
      existingDependencies.add(
        `${Number(prerequisiteId)}->${dependentId}`
      );
    }
  }

  const seenSuggestions = new Set();

  const normalized = [];

  for (const item of rawSuggestions) {
    const taskId = Number(
      item?.taskId
    );

    const suggestedPrerequisiteId =
      Number(
        item?.suggestedPrerequisiteId
      );

    if (
      !Number.isInteger(taskId) ||
      !Number.isInteger(
        suggestedPrerequisiteId
      )
    ) {
      continue;
    }

    if (
      !taskIds.has(taskId) ||
      !taskIds.has(
        suggestedPrerequisiteId
      )
    ) {
      continue;
    }

    /**
     * A task cannot depend on itself.
     */
    if (
      taskId ===
      suggestedPrerequisiteId
    ) {
      continue;
    }

    const key =
      `${suggestedPrerequisiteId}->${taskId}`;

    /**
     * Avoid suggestions that already exist.
     */
    if (
      existingDependencies.has(key)
    ) {
      continue;
    }

    /**
     * Avoid duplicate AI suggestions
     * in the same response.
     */
    if (
      seenSuggestions.has(key)
    ) {
      continue;
    }

    seenSuggestions.add(key);

    const reason =
      typeof item.reason === 'string' &&
      item.reason.trim().length > 0
        ? item.reason.trim()
        : 'Suggested based on the relationship between the task titles and descriptions.';

    normalized.push({
      taskId,
      suggestedPrerequisiteId,
      reason
    });
  }

  return normalized;
}

/**
 * Generate AI-assisted dependency suggestions.
 *
 * Important:
 * - AI only proposes relationships.
 * - AI does not directly modify the database.
 * - Accepted suggestions are sent through the normal
 *   dependency endpoint where DAG validation is enforced.
 */
async function getAISuggestions(tasks) {
  if (!Array.isArray(tasks) || tasks.length < 2) {
    return [];
  }

  const openai = createOpenAIClient();

  if (!openai) {
    const error =
      new Error(
        'OPENAI_API_KEY is not configured.'
      );

    error.code =
      'OPENAI_API_KEY_MISSING';

    throw error;
  }

  const taskContext = tasks.map(
    (task) => ({
      id: Number(task.id),
      title: task.title || '',
      description:
        task.description || '',
      status:
        task.status_column || '',
      prerequisite_ids:
        Array.isArray(
          task.prerequisite_ids
        )
          ? task.prerequisite_ids.map(Number)
          : []
    })
  );

  const systemPrompt = `
You are a workflow dependency analysis assistant.

Your job is to suggest plausible prerequisite relationships
between the existing tasks in a project.

Rules:
1. Only use task IDs that are present in the supplied task list.
2. A suggestion must be represented as:
   prerequisite -> dependent
3. Do not suggest a task as its own prerequisite.
4. Do not repeat a dependency that already exists.
5. Do not invent tasks, IDs, or project information.
6. Base suggestions on task titles, descriptions, workflow context,
   and the relationships already present in the supplied data.
7. Return only relationships that are reasonably defensible.
8. Provide a short explanation for every suggestion.
9. These are recommendations for human review, not automatically
   valid dependencies. The application backend will independently
   validate accepted relationships.
`;

  const userPrompt = `
Analyze the following existing TaskFlow Pro task set and suggest
logical dependency relationships.

Existing tasks:
${JSON.stringify(
  taskContext,
  null,
  2
)}

Return a JSON object in exactly this shape:

{
  "suggestions": [
    {
      "taskId": 10,
      "suggestedPrerequisiteId": 7,
      "reason": "Task 7 should be completed before Task 10 because ..."
    }
  ]
}

Return an empty suggestions array when there are no strong
dependency suggestions.
`;

  try {
    const completion =
      await openai.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: systemPrompt.trim()
          },
          {
            role: 'user',
            content: userPrompt.trim()
          }
        ],
        response_format: {
          type: 'json_object'
        },
        temperature: 0.2
      });

    const content =
      completion
        ?.choices?.[0]
        ?.message
        ?.content;

    if (!content) {
      return [];
    }

    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error(
        'AI suggestion JSON parse error:',
        parseError
      );

      return [];
    }

    return normalizeSuggestions(
      parsed?.suggestions,
      tasks
    );
  } catch (error) {
    console.error(
      'AI dependency suggestion error:',
      error
    );

    throw error;
  }
}

module.exports = {
  getAISuggestions
};