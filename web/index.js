// web/index.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import requestPurchaseRouter from "./routes/request-purchase.js";

dotenv.config();

const app = express();
app.use(express.json());

// Enable CORS for dev testing if needed
if (process.env.ENABLE_CORS_FOR_DEV === "true") {
  app.use(cors());
}

// App Proxy path: Shopify will forward requests to /apps/request-purchase
app.use("/request-purchase", requestPurchaseRouter);

// Health check
app.get("/", (_req, res) => res.send("OK"));

// Crash logging
process.on("uncaughtException", (err) => console.error("UNCAUGHT EX:", err));
process.on("unhandledRejection", (err) => console.error("UNHANDLED REJECTION:", err));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
