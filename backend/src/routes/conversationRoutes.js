import express from "express";

import {
  getConversations,
  getConversation
} from "../controllers/conversationController.js";

import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Get all conversations of logged-in user
router.get("/", authMiddleware, getConversations);

// Get one particular conversation
router.get("/:id", authMiddleware, getConversation);

export default router;