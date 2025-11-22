// index.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import requestPurchaseRouter from "./routes/request-purchase.js";

dotenv.config();

const app = express();
app.use(express.json());

// Optional: allow CORS for direct testing (not required for App Proxy)
if (process.env.ENABLE_CORS_FOR_DEV === "true") {
  app.use(cors());
}

// Mount router at /apps/request-purchase to match Shopify App Proxy
app.use("/apps/request-purchase", requestPurchaseRouter);

// Basic health endpoint
app.get("/", (_req, res) => res.send("OK"));

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
