
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

export const extractAndSaveMemories = async (
  conversation,
  userId
) => {
  try {
    const recentMessages = conversation.messages.slice(-12);

    if (recentMessages.length < 2) return;

    const transcript = recentMessages
      .map((message) => `${message.role}: ${message.content}`)
      .join("\n");

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "system",
          content: `You extract useful, long-term memories from conversations.

Identify stable and meaningful information about the user, such as:
academics, hobbies, friends, music, preferences, plans and personal interests.

Rules:
- Extract only information explicitly supported by the conversation.
- Ignore temporary questions, general knowledge and casual small talk.
- Never extract passwords, authentication tokens or highly sensitive information.
- Do not invent or assume facts.
- Return an empty array if nothing is worth remembering.
- Return ONLY valid JSON in this format:
{
  "memories": [
    {
      "title": "Short title",
      "summary": "A concise factual description",
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
      temperature: 0.2,
      max_tokens: 1200
    });

    const raw = completion.choices[0]?.message?.content;

    if (!raw) return;

    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed.memories)) return;

    for (const item of parsed.memories) {
      if (
        typeof item.title !== "string" ||
        typeof item.summary !== "string" ||
        !item.title.trim() ||
        !item.summary.trim()
      ) {
        continue;
      }

      const category = categories.includes(item.category)
        ? item.category
        : "other";

      // Find an existing memory with a similar title.
      const existing = await Memory.findOne({
        userId,
        title: {
          $regex: `^${item.title.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          $options: "i"
        }
      });

      let folder = await MemoryFolder.findOne({
        userId,
        name: category
      });

      if (!folder) {
        folder = await MemoryFolder.create({
          userId,
          name: category,
          description: `Automatically collected ${category} memories`
        });
      }

      if (existing) {
        existing.summary = item.summary.trim();
        existing.category = category;
        existing.folderId = folder._id;
        existing.sourceConversationId = conversation._id;
        existing.lastMentionedAt = new Date();

        await existing.save();
      } else {
        await Memory.create({
          userId,
          folderId: folder._id,
          title: item.title.trim(),
          summary: item.summary.trim(),
          category,
          sourceConversationId: conversation._id,
          lastMentionedAt: new Date()
        });
      }
    }
  } catch (error) {
    console.error("Memory extraction failed:", error.message);
  }
};
