
import mongoose from "mongoose";
import Memory from "../models/Memory.js";
import MemoryFolder from "../models/MemoryFolder.js";

// Helper: escape special regex characters in search text
const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// Helper: validate folder ownership
const validateFolder = async (folderId, userId) => {
  if (!folderId) return true;

  if (!mongoose.isValidObjectId(folderId)) {
    return false;
  }

  const folder = await MemoryFolder.findOne({
    _id: folderId,
    userId
  });

  return !!folder;
};

// CREATE MEMORY
export const createMemory = async (req, res) => {
  try {
    const {
      title,
      summary,
      category,
      folderId
    } = req.body;

    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof summary !== "string" ||
      !summary.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Title and summary are required"
      });
    }

    if (title.trim().length > 200 || summary.trim().length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Title or summary exceeds the allowed length"
      });
    }

    if (folderId !== undefined && folderId !== null) {
      const validFolder = await validateFolder(
        folderId,
        req.user._id
      );

      if (!validFolder) {
        return res.status(400).json({
          success: false,
          message: "Invalid folder or folder does not belong to you"
        });
      }
    }

    const memory = await Memory.create({
      userId: req.user._id,
      title: title.trim(),
      summary: summary.trim(),
      category: category || "other",
      folderId: folderId || null
    });

    return res.status(201).json({
      success: true,
      message: "Memory created successfully",
      memory
    });

  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    console.error("Create memory error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create memory"
    });
  }
};

// GET ALL MEMORIES WITH SEARCH AND FILTERS
export const getMemories = async (req, res) => {
  try {
    const {
      search,
      category,
      folderId,
      archived,
      page = 1,
      limit = 20
    } = req.query;

    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(limit, 10) || 20)
    );

    const filter = {
      userId: req.user._id
    };

    if (category) {
      filter.category = category;
    }

    if (folderId === "none") {
      filter.folderId = null;
    } else if (folderId) {
      if (!mongoose.isValidObjectId(folderId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid folder ID"
        });
      }

      const validFolder = await validateFolder(
        folderId,
        req.user._id
      );

      if (!validFolder) {
        return res.status(404).json({
          success: false,
          message: "Folder not found"
        });
      }

      filter.folderId = folderId;
    }

    if (archived !== undefined) {
      if (!["true", "false"].includes(archived)) {
        return res.status(400).json({
          success: false,
          message: "Invalid archived filter"
        });
      }

      filter.isArchived = archived === "true";
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(
        escapeRegex(search.trim()),
        "i"
      );

      filter.$or = [
        { title: searchRegex },
        { summary: searchRegex }
      ];
    }

    const [memories, total] = await Promise.all([
      Memory.find(filter)
        .sort({ updatedAt: -1 })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize)
        .populate("folderId", "name"),

      Memory.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      memories,
      pagination: {
        total,
        page: pageNumber,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    });

  } catch (error) {
    console.error("Get memories error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch memories"
    });
  }
};

// GET SINGLE MEMORY
export const getMemoryById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid memory ID"
      });
    }

    const memory = await Memory.findOne({
      _id: id,
      userId: req.user._id
    }).populate("folderId", "name");

    if (!memory) {
      return res.status(404).json({
        success: false,
        message: "Memory not found"
      });
    }

    return res.status(200).json({
      success: true,
      memory
    });

  } catch (error) {
    console.error("Get memory error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch memory"
    });
  }
};

// UPDATE MEMORY
export const updateMemory = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      summary,
      category,
      folderId
    } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid memory ID"
      });
    }

    const memory = await Memory.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!memory) {
      return res.status(404).json({
        success: false,
        message: "Memory not found"
      });
    }

    if (title !== undefined) {
      if (
        typeof title !== "string" ||
        !title.trim() ||
        title.trim().length > 200
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid title"
        });
      }

      memory.title = title.trim();
    }

    if (summary !== undefined) {
      if (
        typeof summary !== "string" ||
        !summary.trim() ||
        summary.trim().length > 5000
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid summary"
        });
      }

      memory.summary = summary.trim();
    }

    if (category !== undefined) {
      memory.category = category;
    }

    if (folderId !== undefined) {
      if (folderId !== null && folderId !== "") {
        const validFolder = await validateFolder(
          folderId,
          req.user._id
        );

        if (!validFolder) {
          return res.status(400).json({
            success: false,
            message: "Invalid folder or folder does not belong to you"
          });
        }

        memory.folderId = folderId;
      } else {
        memory.folderId = null;
      }
    }

    await memory.save();

    return res.status(200).json({
      success: true,
      message: "Memory updated successfully",
      memory
    });

  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    console.error("Update memory error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update memory"
    });
  }
};

// MOVE MEMORY TO ANOTHER FOLDER
export const moveMemory = async (req, res) => {
  try {
    const { id } = req.params;
    const { folderId } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid memory ID"
      });
    }

    if (folderId !== null && folderId !== undefined && folderId !== "") {
      const validFolder = await validateFolder(
        folderId,
        req.user._id
      );

      if (!validFolder) {
        return res.status(400).json({
          success: false,
          message: "Invalid folder or folder does not belong to you"
        });
      }
    }

    const memory = await Memory.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!memory) {
      return res.status(404).json({
        success: false,
        message: "Memory not found"
      });
    }

    memory.folderId = folderId || null;

    await memory.save();

    return res.status(200).json({
      success: true,
      message: "Memory moved successfully",
      memory
    });

  } catch (error) {
    console.error("Move memory error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to move memory"
    });
  }
};

// DELETE MEMORY
export const deleteMemory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid memory ID"
      });
    }

    const memory = await Memory.findOneAndDelete({
      _id: id,
      userId: req.user._id
    });

    if (!memory) {
      return res.status(404).json({
        success: false,
        message: "Memory not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Memory deleted successfully"
    });

  } catch (error) {
    console.error("Delete memory error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete memory"
    });
  }
};

// DELETE ALL MEMORIES BELONGING TO THE LOGGED-IN USER
export const clearAllMemories = async (req, res) => {
  try {
    const result = await Memory.deleteMany({
      userId: req.user._id
    });

    return res.status(200).json({
      success: true,
      message: "All memories cleared successfully",
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error("Clear all memories error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to clear memories"
    });
  }
};

