
import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import membershipRoutes from "./routes/membership.routes.js";
import equbRoutes from "./routes/equb.routes.js";
import receiptRoutes from "./routes/receipt.routes.js";
import lotteryRoutes from "./routes/lottery.routes.js";

import { apiLimiter } from "./middleware/rateLimiter.js";
import { loginLimiter } from "./middleware/loginLimiter.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Eqlub API is running",
  });
});

// General rate limit for API routes
app.use("/api", apiLimiter);

// Authentication routes
app.use("/api/auth", loginLimiter, authRoutes);

// Application routes
app.use("/api", membershipRoutes);
app.use("/api/equbs", equbRoutes);
app.use("/api", receiptRoutes);
app.use("/api", lotteryRoutes);

export default app;