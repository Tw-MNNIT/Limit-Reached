
import mongoose from "mongoose";

const memorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    folderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MemoryFolder",
      default: null
    },

    title: {
      type: String,
      required: true,
      trim: true
    },

    summary: {
      type: String,
      required: true,
      trim: true
    },

    category: {
      type: String,
      enum: [
        "academics",
        "hobbies",
        "friends",
        "music",
        "preferences",
        "plans",
        "personal",
        "other"
      ],
      default: "other"
    },

    sourceConversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: null
    },

    sourceMessageIds: [{
      type: String
    }],

    isArchived: {
      type: Boolean,
      default: false
    },

    lastMentionedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

memorySchema.index({ userId: 1, category: 1 });
memorySchema.index({ userId: 1, folderId: 1 });
memorySchema.index({ userId: 1, updatedAt: -1 });

const Memory = mongoose.model("Memory", memorySchema);

export default Memory;
