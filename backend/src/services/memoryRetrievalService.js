
import { pipeline } from "@huggingface/transformers";
import Memory from "../models/Memory.js";

const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";

const MAX_CANDIDATE_MEMORIES = 300;
const MAX_RETRIEVED_MEMORIES = 5;
const MIN_SIMILARITY = 0.25;

let embeddingPipelinePromise = null;

const JAVASCRIPT_FRAMEWORKS = [
  "react",
  "vue",
  "angular",
  "svelte",
  "next.js",
  "nextjs",
  "nuxt",
  "express",
  "astro",
  "solid",
  "ember",
  "jquery"
];

const getEmbeddingPipeline = async () => {
  if (!embeddingPipelinePromise) {
    embeddingPipelinePromise = pipeline(
      "feature-extraction",
      MODEL_NAME
    );
  }

  return embeddingPipelinePromise;
};

export const generateEmbedding = async (text) => {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error(
      "Cannot generate an embedding for empty text."
    );
  }

  const extractor = await getEmbeddingPipeline();

  const output = await extractor(text.trim(), {
    pooling: "mean",
    normalize: true
  });

  return Array.from(output.data);
};

const cosineSimilarity = (a, b) => {
  if (
    !Array.isArray(a) ||
    !Array.isArray(b) ||
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

  const denominator = Math.sqrt(
    magnitudeA * magnitudeB
  );

  if (!denominator) return 0;

  return dotProduct / denominator;
};

const shouldRetrieveMemories = (message) => {
  const text = message.trim().toLowerCase();

  if (text.length < 12) return false;

  const simpleMessages = [
    /^(hi|hello|hey|hii|hiii)[!. ]*$/,
    /^(good morning|good evening|good night)[!. ]*$/,
    /^(thanks|thank you|thx)[!. ]*$/,
    /^(bye|goodbye|see you)[!. ]*$/
  ];

  return !simpleMessages.some((pattern) =>
    pattern.test(text)
  );
};

const calculateRecencyScore = (date) => {
  if (!date) return 0.5;

  const ageInDays = Math.max(
    0,
    (Date.now() - new Date(date).getTime()) /
      86400000
  );

  const halfLifeDays = 120;

  return Math.exp(
    (-Math.LN2 * ageInDays) / halfLifeDays
  );
};

const calculateImportanceScore = (
  importance = 3
) => {
  const normalized = Math.min(
    5,
    Math.max(1, Number(importance) || 3)
  );

  return (normalized - 1) / 4;
};

const getMemoryText = (memory) => {
  return `${memory.title}. ${memory.summary}`;
};

const normalizeText = (text) => {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const getWords = (text) => {
  return normalizeText(text)
    .split(" ")
    .filter((word) => word.length > 2);
};

const escapeRegExp = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const containsFrameworkName = (text) => {
  const normalized = normalizeText(text);

  return JAVASCRIPT_FRAMEWORKS.some((framework) => {
    const escaped = escapeRegExp(framework);

    return new RegExp(
      `\\b${escaped}\\b`,
      "i"
    ).test(normalized);
  });
};

// Detect questions about the user's current framework.
const isFrameworkQuestion = (message) => {
  const text = normalizeText(message);

  const mentionsFrameworkTopic =
    /\b(framework|library|frontend|front end|web development|javascript framework)\b/i
      .test(text) ||
    containsFrameworkName(text);

  const asksAboutLearning =
    /\b(learning|studying|currently|now|using|working on|started|focus|focusing)\b/i
      .test(text);

  return (
    mentionsFrameworkTopic &&
    asksAboutLearning
  );
};

// Detect questions asking for historical information.
const isHistoricalQuestion = (message) => {
  const text = normalizeText(message);

  return /\b(before|previously|previous|earlier|used to|in the past|prior to|before that|what was i learning|what was i using)\b/i
    .test(text);
};

// Find the framework mentioned in a historical question.
// Example: "What was I learning before Angular?" -> "angular"
const getFrameworkTarget = (message) => {
  const text = normalizeText(message);

  return JAVASCRIPT_FRAMEWORKS.find((framework) => {
    const escaped = escapeRegExp(framework);

    return new RegExp(
      `\\b${escaped}\\b`,
      "i"
    ).test(text);
  }) || null;
};

const calculateLexicalScore = (
  query,
  memoryText
) => {
  const queryWords = new Set(getWords(query));
  const memoryWords = new Set(getWords(memoryText));

  if (queryWords.size === 0) return 0;

  let matches = 0;

  for (const word of queryWords) {
    if (memoryWords.has(word)) {
      matches++;
    }
  }

  return matches / queryWords.size;
};

export const retrieveRelevantMemories = async (
  message,
  userId
) => {
  try {
    if (
      !userId ||
      !shouldRetrieveMemories(message)
    ) {
      return [];
    }

    const frameworkQuestion =
      isFrameworkQuestion(message) ||
      containsFrameworkName(message);

    const historicalQuestion =
      isHistoricalQuestion(message);

    const frameworkTarget =
      getFrameworkTarget(message);

    let embeddingQuery = message;

    if (frameworkQuestion && historicalQuestion) {
      embeddingQuery =
        `${message}. Retrieve the user's previous or historical ` +
        `JavaScript framework, especially the framework they used ` +
        `immediately before the mentioned framework.`;
    } else if (frameworkQuestion) {
      embeddingQuery =
        `${message}. Which JavaScript frontend framework or ` +
        `library is the user currently learning or using?`;
    }

    const queryEmbedding = await generateEmbedding(
      embeddingQuery
    );

    // Historical memories are included only for questions
    // explicitly asking about the past.
    const statusConditions = [
      { status: "active" },
      { status: "conflict" },
      { status: { $exists: false } }
    ];

    if (historicalQuestion) {
      statusConditions.push({
        status: "outdated",
        timelineStatus: "previous"
      });
    }

    const memories = await Memory.find({
      userId,
      isArchived: false,
      $or: statusConditions
    })
      .sort({ updatedAt: -1 })
      .limit(MAX_CANDIDATE_MEMORIES);

    if (memories.length === 0) {
      return [];
    }

    const rankedMemories = [];

    for (const memory of memories) {
      let embedding = memory.embedding;

      // Generate and store embeddings for older memories.
      if (
        !Array.isArray(embedding) ||
        embedding.length === 0
      ) {
        embedding = await generateEmbedding(
          getMemoryText(memory)
        );

        memory.embedding = embedding;
        await memory.save();
      }

      const memoryText = getMemoryText(memory);

      const similarity = cosineSimilarity(
        queryEmbedding,
        embedding
      );

      const lexicalScore =
        calculateLexicalScore(
          message,
          memoryText
        );

      if (
        similarity < MIN_SIMILARITY &&
        lexicalScore < 0.15
      ) {
        // Historical timeline memories may have lower
        // semantic similarity, but should still be included
        // when the query explicitly asks about the past.
        if (
          !(
            historicalQuestion &&
            memory.timelineStatus === "previous"
          )
        ) {
          continue;
        }
      }

      const importance = calculateImportanceScore(
        memory.importance
      );

      const recency = calculateRecencyScore(
        memory.lastMentionedAt ||
          memory.updatedAt
      );

      let score =
        similarity * 0.62 +
        lexicalScore * 0.16 +
        importance * 0.12 +
        recency * 0.10;

      if (frameworkQuestion) {
        if (containsFrameworkName(memoryText)) {
          score += 0.20;
        }

        if (
          /\b(currently|now|focusing on|learning|studying|using)\b/i
            .test(memoryText)
        ) {
          score += 0.08;
        }

        if (
          /\b(javascript|js)\b/i.test(memoryText) &&
          !containsFrameworkName(memoryText)
        ) {
          score -= 0.08;
        }
      }

      if (historicalQuestion) {
        // Prefer the structured Previous Framework memory
        // over older transition notes.
        if (
          memory.title.trim().toLowerCase() ===
          "previous framework"
        ) {
          score += 0.45;
        }

        if (memory.timelineStatus === "previous") {
          score += 0.25;
        }

        // If the user asks "before Angular", prioritize
        // a memory whose timeline explicitly mentions Angular.
        if (
          frameworkTarget &&
          new RegExp(
            `\\b${escapeRegExp(frameworkTarget)}\\b`,
            "i"
          ).test(memoryText)
        ) {
          score += 0.25;
        }

        // Avoid answering a historical question with
        // the current framework memory.
        if (
          memory.title.trim().toLowerCase() ===
            "current framework" ||
          memory.timelineStatus === "current"
        ) {
          score -= 0.30;
        }
      }

      rankedMemories.push({
        memory,
        similarity,
        lexicalScore,
        score
      });
    }

    rankedMemories.sort(
      (a, b) => b.score - a.score
    );

    const results = rankedMemories
      .slice(0, MAX_RETRIEVED_MEMORIES)
      .map(
        ({
          memory,
          similarity,
          lexicalScore,
          score
        }) => ({
          id: memory._id,
          title: memory.title,
          summary: memory.summary,
          category: memory.category,
          folderId: memory.folderId,
          status: memory.status || "active",
          timelineStatus: memory.timelineStatus || "current",
          validFrom: memory.validFrom || null,
          validUntil: memory.validUntil || null,
          importance: memory.importance ?? 3,
          similarity: Number(
            similarity.toFixed(3)
          ),
          lexicalScore: Number(
            lexicalScore.toFixed(3)
          ),
          score: Number(score.toFixed(3))
        })
      );

    console.log(
      "JOI memory ranking:",
      results.map((memory) => ({
        title: memory.title,
        status: memory.status,
        timelineStatus: memory.timelineStatus,
        similarity: memory.similarity,
        lexicalScore: memory.lexicalScore,
        score: memory.score
      }))
    );

    return results;
  } catch (error) {
    console.error(
      "JOI MEMORY RETRIEVAL ERROR:",
      error.message
    );

    return [];
  }
};
