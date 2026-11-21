
import Groq from "groq-sdk";
import joiPrompt from "../prompts/joiPrompt.js";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

export const generateAIResponse = async (conversationMessages) => {
  const history = conversationMessages
    .slice(-20)
    .map((msg) => ({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content
    }));

  const completion = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: [
      {
        role: "system",
        content: joiPrompt
      },
      ...history
    ],
    temperature: 0.7,
    max_tokens: 1024
  });

  const reply = completion.choices[0]?.message?.content;

  if (!reply) {
    throw new Error("Groq returned an empty response.");
  }

  return reply;
};
