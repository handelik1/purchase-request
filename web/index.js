// index.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import requestPurchaseRoute from "./routes/request-purchase.js";

dotenv.config();

const app = express();

// Middleware
app.use(express.json());

// Optional: Enable CORS for testing outside Shopify (can remove in production)
app.use(cors());

// Mount route
app.use("/request-purchase", requestPurchaseRoute);

// Health check
app.get("/", (req, res) => res.send("Backend is running"));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
