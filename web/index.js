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

// Route for purchase request
app.use("/request-purchase", requestPurchaseRouter);

// Health check
app.get("/", (_req, res) => res.send("OK"));

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
