
import MemoryFolder from "../models/MemoryFolder.js";
import Memory from "../models/Memory.js";

// Create a folder
export const createFolder = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Folder name is required"
      });
    }

    const folder = await MemoryFolder.create({
      userId: req.user._id,
      name: name.trim(),
      description: description || ""
    });

    return res.status(201).json({
      success: true,
      folder
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A folder with this name already exists"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create folder",
      error: error.message
    });
  }
};

// Get all folders belonging to logged-in user
export const getFolders = async (req, res) => {
  try {
    const folders = await MemoryFolder.find({
      userId: req.user._id
    }).sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      folders
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch folders",
      error: error.message
    });
  }
};

// Rename a folder
export const renameFolder = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Folder name is required"
      });
    }

    const folder = await MemoryFolder.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: "Folder not found"
      });
    }

    folder.name = name.trim();

    if (description !== undefined) {
      folder.description = description;
    }

    await folder.save();

    return res.status(200).json({
      success: true,
      message: "Folder updated successfully",
      folder
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A folder with this name already exists"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update folder",
      error: error.message
    });
  }
};

// Delete a folder without deleting its memories
export const deleteFolder = async (req, res) => {
  try {
    const folder = await MemoryFolder.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: "Folder not found"
      });
    }

    // Move memories to uncategorized
    await Memory.updateMany(
      {
        folderId: folder._id,
        userId: req.user._id
      },
      {
        $set: { folderId: null }
      }
    );

    await folder.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Folder deleted and its memories moved to uncategorized"
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete folder",
      error: error.message
    });
  }
};
