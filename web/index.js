import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import requestPurchaseRouter from "./routes/request-purchase.js";

dotenv.config();

const app = express();
app.use(express.json());

// ✅ Enable CORS for Shopify dev store
const SHOPIFY_DEV_STORE = process.env.SHOPIFY_DEV_STORE_ORIGIN || "https://testing-approval.myshopify.com";
app.use(cors({
  origin: SHOPIFY_DEV_STORE,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  credentials: true
}));

// Your routes
app.use("/request-purchase", requestPurchaseRouter);

// Health check
app.get("/", (_req, res) => res.send("OK"));

// Crash logging
process.on("uncaughtException", (err) => console.error("UNCAUGHT EX:", err));
process.on("unhandledRejection", (err) => console.error("UNHANDLED REJECTION:", err));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
