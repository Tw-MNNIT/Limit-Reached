import Conversation from "../models/Conversation.js";
import mongoose from "mongoose";

// Get all conversations
export const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      user: req.user._id
    })
      .select("title createdAt updatedAt")
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      conversations
    });

  } catch (error) {
    console.error("Fetch conversations error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch conversations."
    });
  }
};

// Get a particular conversation
export const getConversation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID."
      });
    }

    const conversation = await Conversation.findOne({
      _id: id,
      user: req.user._id
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found."
      });
    }

    return res.status(200).json({
      success: true,
      conversation
    });

  } catch (error) {
    console.error("Fetch conversation error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to open conversation."
    });
  }
};