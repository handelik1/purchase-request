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

// App Proxy forwards /apps/request-purchase -> your Render app -> route mounted at /request-purchase
app.use("/request-purchase", requestPurchaseRouter);

app.get("/", (_req, res) => res.send("OK"));

process.on("uncaughtException", (err) => console.error("UNCAUGHT EXCEPTION:", err));
process.on("unhandledRejection", (err) => console.error("UNHANDLED PROMISE REJECTION:", err));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
