
import Conversation from "../models/Conversation.js";
import mongoose from "mongoose";
import { generateAIResponse } from "../services/llmService.js";
import { extractAndSaveMemories } from "../services/memoryService.js";

const MAX_MESSAGE_LENGTH = 12000;
const MAX_CONTEXT_MESSAGES = 20;

export const chatWithAI = async (req, res) => {
  try {
    const { message, conversationId } = req.body;

    // Validate the user's message
    if (
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid message."
      });
    }

    const userMessage = message.trim();

    if (userMessage.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Message is too long. Maximum length is ${MAX_MESSAGE_LENGTH} characters.`
      });
    }

    const userId = req.user._id;

    let conversation;

    // Find an existing conversation belonging to this user
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

    // Prepare a focused context window for the LLM
    const conversationHistory = conversation.messages
      .slice(-MAX_CONTEXT_MESSAGES)
      .map((msg) => ({
        role: msg.role,
        content: msg.content
      }));

    console.log(
      `JOI: Generating response using ${conversationHistory.length} recent messages.`
    );

    // Generate JOI's response
    const reply = await generateAIResponse(conversationHistory);

    if (typeof reply !== "string" || !reply.trim()) {
      throw new Error("The AI service returned an empty response.");
    }

    const finalReply = reply.trim();

    // Save JOI's reply
    conversation.messages.push({
      role: "assistant",
      content: finalReply
    });

    await conversation.save();

    console.log("JOI: Conversation saved successfully!");

    // Extract memories in the background.
    // Memory extraction errors must not affect the chat response.
    void extractAndSaveMemories(conversation, userId).catch((error) => {
      console.error("JOI MEMORY EXTRACTION ERROR:", error.message);
    });

    return res.status(200).json({
      success: true,
      reply: finalReply,
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
