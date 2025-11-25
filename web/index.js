import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import requestPurchaseRouter from "../routes/request-purchase.js";

dotenv.config();

const app = express();
app.use(express.json());

if (process.env.ENABLE_CORS_FOR_DEV === "true") {
  app.use(cors());
}

// Shopify App Proxy POST endpoint
app.use("/request-purchase", requestPurchaseRouter);

// Health check
app.get("/", (_req, res) => res.send("OK"));

const PORT = process.env.PORT || 10000;

// Debug crash logs
process.on("uncaughtException", err => console.error("UNCAUGHT:", err));
process.on("unhandledRejection", err => console.error("UNHANDLED:", err));

app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
