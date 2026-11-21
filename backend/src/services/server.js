
import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import connectDB from "../config/database.js";

import authRoutes from "../routes/authRoutes.js";
import aiRoutes from "../routes/aiRoutes.js";
import conversationRoutes from "../routes/conversationRoutes.js";

import authMiddleware from "../middleware/authMiddleware.js";

const app = express();

// Validate required environment variables
const requiredEnvVariables = [
  "MONGODB_URI",
  "JWT_SECRET",
  "GROQ_API_KEY",
  "FRONTEND_URL"
];

for (const variable of requiredEnvVariables) {
  if (!process.env[variable]) {
    console.error(`Missing environment variable: ${variable}`);
    process.exit(1);
  }
}

// Security middleware
app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_URL
}));

app.use(express.json({ limit: "1mb" }));

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later."
  }
});

app.use("/api", apiLimiter);

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "JOI backend is running!"
  });
});

// Authentication routes
app.use("/api/auth", authRoutes);

// AI test route
app.get("/api/ai/test", (req, res) => {
  res.json({
    success: true,
    message: "AI route is working!"
  });
});

// AI chat routes
app.use("/api/ai", aiRoutes);

// Conversation history routes
app.use("/api/conversations", conversationRoutes);

// Current logged-in user
app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.status(200).json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email
    }
  });
});

// Start server
const startServer = async () => {
  try {
    await connectDB();

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log(`JOI server running on port ${PORT}`);
    });

  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
