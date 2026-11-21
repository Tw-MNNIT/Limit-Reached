
import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";

import {
  createMemory,
  getMemories,
  getMemoryById,
  updateMemory,
  moveMemory,
  deleteMemory,
  clearAllMemories
} from "../controllers/memoryController.js";

const router = express.Router();

// All memory routes require authentication
router.use(authMiddleware);

router.post("/", createMemory);
router.get("/", getMemories);
router.delete("/", clearAllMemories);
router.get("/:id", getMemoryById);
router.put("/:id", updateMemory);
router.patch("/:id/move", moveMemory);
router.delete("/:id", deleteMemory);

export default router;
