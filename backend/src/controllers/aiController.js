
import Conversation from "../models/Conversation.js";
import mongoose from "mongoose";
import { generateAIResponse } from "../services/llmService.js";
import { extractAndSaveMemories } from "../services/memoryService.js";

export const chatWithAI = async (req, res) => {
  try {
    const { message, conversationId } = req.body;

    // Validate user message
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

    console.log("JOI: Sending conversation to LLM service...");

    // Generate AI response
    const reply = await generateAIResponse(conversation.messages);

    // Save JOI's reply
    conversation.messages.push({
      role: "assistant",
      content: reply
    });

    await conversation.save();

    console.log("JOI: Conversation saved successfully!");

    // Extract memories in the background.
    // Memory extraction failures will not affect the chat response.
    void extractAndSaveMemories(conversation, userId);

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
