
import Groq from "groq-sdk";
import Memory from "../models/Memory.js";
import MemoryFolder from "../models/MemoryFolder.js";
import { generateEmbedding } from "./memoryRetrievalService.js";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const categories = [
  "academics",
  "hobbies",
  "friends",
  "music",
  "preferences",
  "plans",
  "personal",
  "other"
];

const MAX_MEMORIES_PER_EXTRACTION = 5;
const MAX_EXISTING_MEMORIES = 200;
const DUPLICATE_SIMILARITY_THRESHOLD = 0.82;
const RELATED_SIMILARITY_THRESHOLD = 0.68;

const frameworkNames = [
  "React",
  "Vue",
  "Angular",
  "Svelte",
  "Solid",
  "Next.js",
  "Nuxt",
  "Astro",
  "Remix",
  "Ember",
  "Backbone"
];

const escapeRegExp = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const frameworkPattern = frameworkNames
  .map(escapeRegExp)
  .sort((a, b) => b.length - a.length)
  .join("|");

const parseJsonResponse = (raw) => {
  const cleaned = raw
    .replace(/```(?:json)?/gi, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error("No JSON object found in model response.");
    }

    return JSON.parse(
      cleaned.slice(firstBrace, lastBrace + 1)
    );
  }
};

const cosineSimilarity = (a, b) => {
  if (
    !Array.isArray(a) ||
    !Array.isArray(b) ||
    a.length === 0 ||
    a.length !== b.length
  ) {
    return 0;
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct /
    (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
};

const getImportance = (value, category, summary) => {
  const parsed = Number(value);

  if (
    Number.isFinite(parsed) &&
    parsed >= 1 &&
    parsed <= 5
  ) {
    return Math.round(parsed);
  }

  const text = `${category} ${summary}`.toLowerCase();

  if (
    text.includes("goal") ||
    text.includes("career") ||
    text.includes("project") ||
    text.includes("preference")
  ) {
    return 4;
  }

  return 3;
};

const getMemoryText = (title, summary) => {
  return `${title}. ${summary}`;
};

const findOrCreateFolder = async (userId, category) => {
  const folder = await MemoryFolder.findOne({
    userId,
    name: {
      $regex: `^${escapeRegExp(category)}$`,
      $options: "i"
    }
  });

  if (folder) {
    return folder;
  }

  const newFolder = await MemoryFolder.create({
    userId,
    name: category,
    description: `Automatically collected ${category} memories`
  });

  console.log(`Created memory folder: ${category}`);

  return newFolder;
};

// Detect explicit framework transitions from the user's own message.
// Examples:
// "I stopped learning Vue and switched to Angular."
// "I switched from React to Vue."
const getFrameworkTransition = (userMessage) => {
  const text = userMessage.trim();

  const stoppedAndSwitchedPattern = new RegExp(
    String.raw`\b(?:stopped|quit|left)\s+(?:learning\s+)?(${frameworkPattern})\b[\s\S]{0,100}?\b(?:switched|changed|moved)\s+to\s+(${frameworkPattern})\b`,
    "i"
  );

  const switchedFromPattern = new RegExp(
    String.raw`\b(?:switched|changed|moved)\s+from\s+(${frameworkPattern})\s+to\s+(${frameworkPattern})\b`,
    "i"
  );

  const changedFromPattern = new RegExp(
    String.raw`\b(?:replaced)\s+(${frameworkPattern})\s+with\s+(${frameworkPattern})\b`,
    "i"
  );

  const patterns = [
    stoppedAndSwitchedPattern,
    switchedFromPattern,
    changedFromPattern
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      const fromFramework = match[1];
      const toFramework = match[2];

      if (
        fromFramework.toLowerCase() !==
        toFramework.toLowerCase()
      ) {
        return {
          fromFramework,
          toFramework
        };
      }
    }
  }

  return null;
};

const memoryContainsFramework = (memory, framework) => {
  const text = `${memory.title} ${memory.summary}`;

  return new RegExp(
    `\\b${escapeRegExp(framework)}\\b`,
    "i"
  ).test(text);
};

const getAllUserMemories = async (userId) => {
  return Memory.find({
    userId,
    isArchived: false
  })
    .sort({ updatedAt: -1 })
    .limit(MAX_EXISTING_MEMORIES);
};

// Save a framework transition as explicit current and previous facts.
// Historical memories remain in MongoDB rather than being deleted.
const saveFrameworkTransition = async ({
  transition,
  conversation,
  userId
}) => {
  const { fromFramework, toFramework } = transition;
  const now = new Date();

  const folder = await findOrCreateFolder(
    userId,
    "academics"
  );

  const allMemories = await getAllUserMemories(userId);

  // Mark matching memories about the old framework as historical.
  // Do not delete them; timeline retrieval will use them later.
  for (const memory of allMemories) {
    if (
      memory.status === "conflict" ||
      !memoryContainsFramework(memory, fromFramework)
    ) {
      continue;
    }

    const isCurrentFrameworkMemory =
      memory.title.trim().toLowerCase() ===
      "current framework";

    const isPreviousFrameworkMemory =
      memory.title.trim().toLowerCase() ===
      "previous framework";

    if (isCurrentFrameworkMemory || isPreviousFrameworkMemory) {
      continue;
    }

    memory.status = "outdated";
    memory.timelineStatus = "previous";
    memory.validUntil = now;

    if (!memory.validFrom) {
      memory.validFrom = memory.createdAt || now;
    }

    await memory.save();

    console.log(
      `Moved framework memory to history: ${memory.title}`
    );
  }

  const previousTitle = "Previous Framework";
  const previousSummary =
    `Immediately before learning ${toFramework}, ` +
    `the user was learning ${fromFramework}.`;

  const currentTitle = "Current Framework";
  const currentSummary =
    `The user is currently learning ${toFramework}.`;

  const previousEmbedding = await generateEmbedding(
    getMemoryText(previousTitle, previousSummary)
  );

  const currentEmbedding = await generateEmbedding(
    getMemoryText(currentTitle, currentSummary)
  );

  let previousMemory = allMemories.find(
    (memory) =>
      memory.title.trim().toLowerCase() ===
      previousTitle.toLowerCase()
  );

  if (previousMemory) {
    previousMemory.folderId = folder._id;
    previousMemory.title = previousTitle;
    previousMemory.summary = previousSummary;
    previousMemory.category = "academics";
    previousMemory.sourceConversationId = conversation._id;
    previousMemory.lastMentionedAt = now;
    previousMemory.importance = 4;
    previousMemory.embedding = previousEmbedding;
    previousMemory.status = "outdated";
    previousMemory.timelineStatus = "previous";
    previousMemory.validUntil = now;

    if (!previousMemory.validFrom) {
      previousMemory.validFrom = now;
    }

    await previousMemory.save();
  } else {
    previousMemory = await Memory.create({
      userId,
      folderId: folder._id,
      title: previousTitle,
      summary: previousSummary,
      category: "academics",
      sourceConversationId: conversation._id,
      sourceMessageIds: [],
      lastMentionedAt: now,
      importance: 4,
      embedding: previousEmbedding,
      status: "outdated",
      timelineStatus: "previous",
      validFrom: now,
      validUntil: now
    });
  }

  let currentMemory = allMemories.find(
    (memory) =>
      memory.title.trim().toLowerCase() ===
      currentTitle.toLowerCase()
  );

  if (currentMemory) {
    currentMemory.folderId = folder._id;
    currentMemory.title = currentTitle;
    currentMemory.summary = currentSummary;
    currentMemory.category = "academics";
    currentMemory.sourceConversationId = conversation._id;
    currentMemory.lastMentionedAt = now;
    currentMemory.importance = 4;
    currentMemory.embedding = currentEmbedding;
    currentMemory.status = "active";
    currentMemory.timelineStatus = "current";
    currentMemory.validFrom = now;
    currentMemory.validUntil = null;

    await currentMemory.save();
  } else {
    currentMemory = await Memory.create({
      userId,
      folderId: folder._id,
      title: currentTitle,
      summary: currentSummary,
      category: "academics",
      sourceConversationId: conversation._id,
      sourceMessageIds: [],
      lastMentionedAt: now,
      importance: 4,
      embedding: currentEmbedding,
      status: "active",
      timelineStatus: "current",
      validFrom: now,
      validUntil: null
    });
  }

  console.log(
    `Framework timeline saved: ${fromFramework} → ${toFramework}`
  );
};

// Ask the model whether a highly similar memory should be updated,
// kept unchanged, treated as a conflict, or saved separately.
const resolveMemoryRelationship = async (
  existingMemory,
  newMemory
) => {
  const completion = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: [
      {
        role: "system",
        content: `
You are JOI's memory maintenance system.

Compare an existing saved memory with a newly extracted user fact.

Return exactly one action:
- "update": the new fact is the same fact, a continuation, or a clear correction.
- "keep": the new fact adds nothing useful or repeats the existing fact.
- "conflict": the facts contradict each other and the user's intent is unclear.
- "new": they are related but represent separate facts and should be stored separately.

Do not treat a new learning topic as a replacement for an older topic.
Do not assume that a user stopped doing something unless they say so.
If the user clearly corrects an old fact, choose "update".
If the contradiction is unclear, choose "conflict".

Return only valid JSON:
{
  "action": "update"
}
`
      },
      {
        role: "user",
        content: JSON.stringify({
          existingMemory: {
            title: existingMemory.title,
            summary: existingMemory.summary
          },
          newMemory: {
            title: newMemory.title,
            summary: newMemory.summary
          }
        })
      }
    ],
    temperature: 0,
    max_tokens: 100
  });

  const raw = completion.choices[0]?.message?.content;

  if (!raw || !raw.trim()) {
    return "new";
  }

  try {
    const parsed = parseJsonResponse(raw);
    const allowedActions = [
      "update",
      "keep",
      "conflict",
      "new"
    ];

    return allowedActions.includes(parsed.action)
      ? parsed.action
      : "new";
  } catch {
    return "new";
  }
};

const getExistingMemories = async (userId) => {
  return Memory.find({
    userId,
    isArchived: false,
    $or: [
      { status: "active" },
      { status: { $exists: false } }
    ]
  })
    .sort({ updatedAt: -1 })
    .limit(MAX_EXISTING_MEMORIES);
};

const findSimilarMemory = async (
  title,
  summary,
  existingMemories
) => {
  const newEmbedding = await generateEmbedding(
    getMemoryText(title, summary)
  );

  let bestMatch = null;
  let bestSimilarity = 0;

  for (const memory of existingMemories) {
    let memoryEmbedding = memory.embedding;

    if (
      !Array.isArray(memoryEmbedding) ||
      memoryEmbedding.length === 0
    ) {
      memoryEmbedding = await generateEmbedding(
        getMemoryText(memory.title, memory.summary)
      );

      memory.embedding = memoryEmbedding;
      await memory.save();
    }

    const similarity = cosineSimilarity(
      newEmbedding,
      memoryEmbedding
    );

    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = memory;
    }
  }

  return {
    newEmbedding,
    bestMatch,
    bestSimilarity
  };
};

const saveMemoryItem = async ({
  item,
  conversation,
  userId,
  existingMemories
}) => {
  if (
    typeof item.title !== "string" ||
    typeof item.summary !== "string" ||
    !item.title.trim() ||
    !item.summary.trim()
  ) {
    console.log("Skipping invalid memory item.");
    return;
  }

  const title = item.title.trim();
  const summary = item.summary.trim();

  const category = categories.includes(item.category)
    ? item.category
    : "other";

  const importance = getImportance(
    item.importance,
    category,
    summary
  );

  const {
    newEmbedding,
    bestMatch,
    bestSimilarity
  } = await findSimilarMemory(
    title,
    summary,
    existingMemories
  );

  // Prefer exact title matches, then semantic similarity.
  const exactTitleMatch = existingMemories.find(
    (memory) =>
      memory.title.trim().toLowerCase() ===
      title.toLowerCase()
  );

  const candidate = exactTitleMatch || bestMatch;
  const similarity = exactTitleMatch
    ? 1
    : bestSimilarity;

  let action = "new";

  if (
    candidate &&
    similarity >= RELATED_SIMILARITY_THRESHOLD
  ) {
    action = await resolveMemoryRelationship(
      candidate,
      { title, summary }
    );
  }

  const folder = await findOrCreateFolder(
    userId,
    category
  );

  if (action === "keep") {
    console.log(`Kept existing memory: ${candidate.title}`);
    return;
  }

  if (action === "update" && candidate) {
    candidate.title = title;
    candidate.summary = summary;
    candidate.category = category;
    candidate.folderId = folder._id;
    candidate.sourceConversationId = conversation._id;
    candidate.lastMentionedAt = new Date();
    candidate.importance = Math.max(
      candidate.importance || 3,
      importance
    );
    candidate.embedding = newEmbedding;
    candidate.status = "active";
    candidate.timelineStatus = "current";
    candidate.validUntil = null;

    if (!candidate.validFrom) {
      candidate.validFrom = new Date();
    }

    await candidate.save();

    console.log(`Updated similar memory: ${title}`);
    return;
  }

  if (action === "conflict" && candidate) {
    candidate.summary =
      `Conflicting information needs clarification. ` +
      `Previously saved: ${candidate.summary} ` +
      `New information: ${summary}`;

    candidate.status = "conflict";
    candidate.lastMentionedAt = new Date();
    candidate.embedding = await generateEmbedding(
      getMemoryText(candidate.title, candidate.summary)
    );

    await candidate.save();

    console.log(`Marked memory conflict: ${candidate.title}`);
    return;
  }

  const createdMemory = await Memory.create({
    userId,
    folderId: folder._id,
    title,
    summary,
    category,
    sourceConversationId: conversation._id,
    sourceMessageIds: [],
    lastMentionedAt: new Date(),
    importance,
    embedding: newEmbedding,
    status: "active",
    timelineStatus: "current",
    validFrom: new Date(),
    validUntil: null
  });

  existingMemories.push(createdMemory);

  console.log(`Created memory: ${title}`);
};

export const extractAndSaveMemories = async (
  conversation,
  userId
) => {
  try {
    if (!conversation?.messages || !userId) {
      console.log(
        "Memory extraction skipped: conversation or userId missing."
      );
      return;
    }

    // Process only the latest user message to avoid repeatedly
    // extracting and updating facts from older conversation history.
    const latestUserMessage = [...conversation.messages]
      .reverse()
      .find(
        (message) =>
          message.role === "user" &&
          typeof message.content === "string" &&
          message.content.trim().length > 0
      );

    if (!latestUserMessage) {
      console.log("Memory extraction skipped: no user message found.");
      return;
    }

    const userMessage = latestUserMessage.content.trim();

    console.log(
      "Starting automatic memory extraction from 1 user message..."
    );

    // Handle clear framework transitions directly before normal
    // extraction, so the model cannot save a vague transition fact
    // instead of the structured current/previous framework memories.
    const frameworkTransition =
      getFrameworkTransition(userMessage);

    if (frameworkTransition) {
      await saveFrameworkTransition({
        transition: frameworkTransition,
        conversation,
        userId
      });

      console.log("Automatic memory extraction completed.");
      return;
    }

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "system",
          content: `
You are JOI's long-term memory extraction system.

Extract useful, factual information about the user from the
user's message only.

Save information that can improve future conversations:
- Education and college
- Current learning topics and study goals
- Learning preferences and recurring difficulties
- Career and internship goals
- Ongoing projects and technologies
- Stable response preferences
- Hobbies and interests
- Important plans and commitments

Rules:
- Extract clear first-person facts.
- A single message can contain useful memories.
- Do not save ordinary questions or one-time tasks.
- Do not use facts from assistant messages.
- Do not guess or infer unsupported details.
- Do not save passwords, tokens, or highly sensitive information.
- Avoid duplicate memories with different wording.
- If the user clearly corrects an old fact, extract the new fact.
- Return an empty array only when no useful long-term information
  is present.
- Return at most ${MAX_MEMORIES_PER_EXTRACTION} memories.
- Assign importance from 1 to 5:
  1 = minor temporary detail
  2 = useful but low priority
  3 = generally useful
  4 = important goal, preference, or ongoing project
  5 = very important long-term information

Allowed categories: ${categories.join(", ")}

Return ONLY valid JSON in this format:
{
  "memories": [
    {
      "title": "Short descriptive title",
      "summary": "One concise factual memory",
      "category": "academics",
      "importance": 3
    }
  ]
}
`
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      temperature: 0.1,
      max_tokens: 1200
    });

    const raw = completion.choices[0]?.message?.content;

    if (!raw || !raw.trim()) {
      console.log("Memory extraction returned an empty response.");
      return;
    }

    console.log("Memory extraction response:", raw);

    const parsed = parseJsonResponse(raw);

    if (!Array.isArray(parsed.memories)) {
      console.log("Memory extraction returned an invalid format.");
      return;
    }

    const memoriesToSave = parsed.memories.slice(
      0,
      MAX_MEMORIES_PER_EXTRACTION
    );

    if (memoriesToSave.length === 0) {
      console.log(
        "No useful long-term memories were found in the user's message."
      );
      console.log("Automatic memory extraction completed.");
      return;
    }

    const existingMemories = await getExistingMemories(userId);

    for (const item of memoriesToSave) {
      await saveMemoryItem({
        item,
        conversation,
        userId,
        existingMemories
      });
    }

    console.log("Automatic memory extraction completed.");
  } catch (error) {
    console.error("Memory extraction failed:", error);
  }
};
