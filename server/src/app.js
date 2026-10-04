import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import membershipRoutes from "./routes/membership.routes.js"
import equbRoutes from "./routes/equb.routes.js";
import receiptRoutes from "./routes/receipt.routes.js";
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
app.use("/api/auth", authRoutes);
app.use("/api", membershipRoutes);
app.use("/api/equbs", equbRoutes);
app.use("/api", receiptRoutes);
export default app;






