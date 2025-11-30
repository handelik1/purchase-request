// web/index.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import requestPurchaseRouter from "./routes/request-purchase.js";

dotenv.config();

const app = express();
app.use(express.json());

if (process.env.ENABLE_CORS_FOR_DEV === "true") {
  app.use(cors());
}

// Route that App Proxy forwards to: /request-purchase
app.use("/request-purchase", requestPurchaseRouter);

// Optional health
app.get("/", (_req, res) => res.send("OK"));

// Crash logging for Render
process.on("uncaughtException", (err) => console.error("UNCAUGHT EX:", err));
process.on("unhandledRejection", (err) => console.error("UNHANDLED REJECTION:", err));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
