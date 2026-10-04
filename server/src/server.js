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

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();