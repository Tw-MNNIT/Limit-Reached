
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

    sourceMessageIds: {
      type: [String],
      default: []
    },

    isArchived: {
      type: Boolean,
      default: false
    },

    lastMentionedAt: {
      type: Date,
      default: Date.now
    },

    importance: {
      type: Number,
      min: 1,
      max: 5,
      default: 3
    },

    embedding: {
      type: [Number],
      default: []
    },

    status: {
      type: String,
      enum: ["active", "outdated", "conflict"],
      default: "active"
    },

    // Timeline: when this fact became true.
    validFrom: {
      type: Date,
      default: Date.now
    },

    // Timeline: when this fact stopped being true.
    // Null means the end date is not known.
    validUntil: {
      type: Date,
      default: null
    },

    // Timeline: current fact or a previous fact.
    timelineStatus: {
      type: String,
      enum: ["current", "previous"],
      default: "current"
    },

    // Timeline: the memory that replaced this one.
    replacedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Memory",
      default: null
    }
  },
  {
    timestamps: true
  }
);

memorySchema.index({
  userId: 1,
  category: 1
});

memorySchema.index({
  userId: 1,
  folderId: 1
});

memorySchema.index({
  userId: 1,
  updatedAt: -1
});

memorySchema.index({
  userId: 1,
  status: 1,
  isArchived: 1
});

// Timeline queries.
memorySchema.index({
  userId: 1,
  timelineStatus: 1,
  validFrom: -1
});

const Memory = mongoose.model("Memory", memorySchema);

export default Memory;
