import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import requestPurchaseRouter from "./routes/request-purchase.js";

dotenv.config();

const app = express();
app.use(express.json());

// -------------------------------------
// ✅ ALLOWED ORIGINS
// -------------------------------------
const ALLOWED_ORIGINS = [
  process.env.SHOPIFY_DEV_STORE_ORIGIN, // dev store
  "https://testing-approval.myshopify.com" // live store
];

// -------------------------------------
// ✅ CORS HANDLER
// -------------------------------------
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);

    console.warn("❌ Blocked CORS Origin:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  credentials: true
}));

// Routes
app.use("/apps/request-purchase", requestPurchaseRouter);

// Root URL
app.get("/", (_req, res) => res.send("Backend online"));

// Crash logging
process.on("uncaughtException", (err) => console.error("UNCAUGHT EX:", err));
process.on("unhandledRejection", (err) => console.error("UNHANDLED REJECTION:", err));

// Listen
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
  console.log("Allowed Origins:", ALLOWED_ORIGINS);
});
