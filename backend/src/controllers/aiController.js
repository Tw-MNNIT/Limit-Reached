import Groq from "groq-sdk";
import Conversation from "../models/Conversation.js";
import mongoose from "mongoose";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

export const chatWithAI = async (req, res) => {
  try {
    const { message, conversationId } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid message."
      });
    }

    const userId = req.user._id;
    const userMessage = message.trim();

    let conversation;

    // Continue an existing conversation
    if (conversationId) {
      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid conversation ID."
        });
      }

      conversation = await Conversation.findOne({
        _id: conversationId,
        user: userId
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: "Conversation not found."
        });
      }
    } else {
      // Create a new conversation
      conversation = await Conversation.create({
        user: userId,
        title: userMessage.substring(0, 40),
        messages: []
      });
    }

    // Save the user's message
    conversation.messages.push({
      role: "user",
      content: userMessage
    });

    await conversation.save();

    console.log("JOI: Sending conversation to Groq...");

    // Prepare conversation history
    const history = conversation.messages
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
          content:
            "You are JOI, a helpful, friendly and intelligent personal AI assistant. Give clear, useful and well-structured answers."
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

    // Save JOI's reply
    conversation.messages.push({
      role: "assistant",
      content: reply
    });

    await conversation.save();

    console.log("JOI: Conversation saved successfully!");

    return res.status(200).json({
      success: true,
      reply,
      conversationId: conversation._id
    });

  } catch (error) {
    console.error("JOI AI ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "JOI could not generate a response. Please try again."
    });
  }
};