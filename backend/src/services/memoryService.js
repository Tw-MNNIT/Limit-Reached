
import Groq from "groq-sdk";
import Memory from "../models/Memory.js";
import MemoryFolder from "../models/MemoryFolder.js";

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

const MAX_MESSAGES = 24;
const MAX_MEMORIES_PER_EXTRACTION = 5;

// Escape special characters before using a title in a regular expression.
const escapeRegExp = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// Parse JSON even if the model wraps it in a Markdown code block
// or includes a short explanation before/after the JSON.
const parseMemoryResponse = (raw) => {
  const cleaned = raw
    .replace(/```(?:json)?/gi, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error("No JSON object found in memory extraction response.");
    }

    return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
  }
};

export const extractAndSaveMemories = async (conversation, userId) => {
  try {
    if (!conversation?.messages || !userId) {
      console.log("Memory extraction skipped: conversation or userId missing.");
      return;
    }

    // Include recent conversation messages, but extract facts only
    // from messages written by the user.
    const recentMessages = conversation.messages.slice(-MAX_MESSAGES);

    const userMessages = recentMessages
      .filter((message) => message.role === "user")
      .filter(
        (message) =>
          typeof message.content === "string" &&
          message.content.trim().length > 0
      );

    if (userMessages.length === 0) {
      console.log("Memory extraction skipped: no user messages found.");
      return;
    }

    const transcript = userMessages
      .map((message) => `User: ${message.content.trim()}`)
      .join("\n\n");

    console.log(
      `Starting automatic memory extraction from ${userMessages.length} user message(s)...`
    );

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "system",
          content: `You are JOI's long-term memory extraction system.

Your job is to identify useful, factual information about the user
from the user's messages and save it as concise memories.

The user does NOT need to explicitly ask you to remember something.

WHAT COUNTS AS A MEMORY:
Save information that is likely to help JOI respond more usefully in
future conversations, including:

- The user's education, college, course, subjects, or study goals
- Topics the user is currently learning
- Learning preferences or recurring difficulties
- Career goals, internship goals, and skills being learned
- Ongoing projects, their names, technologies, and meaningful progress
- Stable communication or response preferences
- Hobbies, books, music, entertainment, and other interests
- Important plans, deadlines, and ongoing commitments
- Personal facts the user directly shares that are useful in future chats

IMPORTANT EXTRACTION RULES:
- A single user message can contain a memory. Do not require repeated mentions.
- Extract clear first-person facts, such as "I'm learning JavaScript"
  or "I prefer short explanations."
- Extract project and goal details even if the user is asking for help
  with a problem related to that project.
- A question about a subject alone is NOT necessarily a memory.
  For example, "What is a binary tree?" should not create a memory.
- Do not save every temporary question, answer, or one-time task.
- Use only information directly supported by the user's messages.
- Do not use facts from the assistant's replies.
- Do not guess the user's identity, preferences, or circumstances.
- Do not save passwords, tokens, or highly sensitive information.
- Prefer specific, useful memories over vague ones.
- Do not create duplicate memories with slightly different wording.
- If the user corrects an earlier fact, use the latest statement.
- Return an empty array only when the user's messages contain no
  useful information for future conversations.
- Return at most ${MAX_MEMORIES_PER_EXTRACTION} memories.

EXAMPLES:

User: "I'm currently learning linked lists in DSA."
Memory: "The user is currently learning linked lists in DSA."
Category: academics

User: "I find recursion difficult and prefer solving problems myself."
Memory: "The user finds recursion challenging and prefers independent
problem-solving when learning."
Category: preferences

User: "I'm building an AI chatbot called JOI using React and Express."
Memory: "The user is developing an AI chatbot called JOI using React
and Express."
Category: plans

User: "Can you explain binary search?"
Memory: No memory, unless the surrounding user messages reveal
a meaningful learning goal or preference.

User: "I am a second-year ECE student and want a software internship."
Memories:
"The user is studying ECE."
"The user wants to obtain a software internship."
Categories: academics, plans

OUTPUT:
Return ONLY valid JSON. Do not include Markdown code fences,
comments, or explanation.

Use exactly this structure:
{
  "memories": [
    {
      "title": "Short descriptive title",
      "summary": "One concise factual memory",
      "category": "academics"
    }
  ]
}

Allowed categories: ${categories.join(", ")}`
        },
        {
          role: "user",
          content: transcript
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

    const parsed = parseMemoryResponse(raw);

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
        "No useful long-term memories were found in the user's messages."
      );
      console.log("Automatic memory extraction completed.");
      return;
    }

    for (const item of memoriesToSave) {
      if (
        typeof item.title !== "string" ||
        typeof item.summary !== "string" ||
        !item.title.trim() ||
        !item.summary.trim()
      ) {
        console.log("Skipping invalid memory item.");
        continue;
      }

      const title = item.title.trim();
      const summary = item.summary.trim();

      const category = categories.includes(item.category)
        ? item.category
        : "other";

      // Find an existing memory with the same title, ignoring case.
      const escapedTitle = escapeRegExp(title);

      const existing = await Memory.findOne({
        userId,
        title: {
          $regex: `^${escapedTitle}$`,
          $options: "i"
        }
      });

      // Find or create the matching category folder.
      let folder = await MemoryFolder.findOne({
        userId,
        name: {
          $regex: `^${escapeRegExp(category)}$`,
          $options: "i"
        }
      });

      if (!folder) {
        folder = await MemoryFolder.create({
          userId,
          name: category,
          description: `Automatically collected ${category} memories`
        });

        console.log(`Created memory folder: ${category}`);
      }

      if (existing) {
        existing.summary = summary;
        existing.category = category;
        existing.folderId = folder._id;
        existing.sourceConversationId = conversation._id;
        existing.lastMentionedAt = new Date();

        await existing.save();

        console.log(`Updated memory: ${title}`);
      } else {
        await Memory.create({
          userId,
          folderId: folder._id,
          title,
          summary,
          category,
          sourceConversationId: conversation._id,
          lastMentionedAt: new Date()
        });

        console.log(`Created memory: ${title}`);
      }
    }

    console.log("Automatic memory extraction completed.");
  } catch (error) {
    console.error("Memory extraction failed:", error);
  }
};
