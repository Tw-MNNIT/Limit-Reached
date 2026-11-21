
import mongoose from "mongoose";

const memoryFolderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      trim: true,
      default: ""
    },

    isDefault: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

memoryFolderSchema.index(
  { userId: 1, name: 1 },
  { unique: true }
);

const MemoryFolder = mongoose.model("MemoryFolder", memoryFolderSchema);

export default MemoryFolder;
