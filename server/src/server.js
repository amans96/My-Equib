
import "dotenv/config";
import app from "./app.js";
import prisma from "./config/database.js";
import express from "express";

const PORT = process.env.PORT || 5000;

app.use("/uploads", express.static("uploads"));

async function startServer() {
  try {
    await prisma.$connect();

    console.log("Database connected successfully");
    console.log(
      "Gemini key loaded:",
      process.env.GEMINI_API_KEY ? "YES" : "NO"
    );

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
      console.log("Local URL: http://localhost:5000");
      console.log("Network URL: http://10.24.49.65:5000");
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();
