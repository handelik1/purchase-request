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
  process.env.SHOPIFY_DEV_STORE_ORIGIN, // your dev origin
  "https://testing-approval.myshopify.com" // live store
];

// -------------------------------------
// ✅ CORS HANDLER
// -------------------------------------
app.use(cors({
  origin: function (origin, callback) {
    // Allow server-to-server or curl/postman (no origin)
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    console.warn("❌ Blocked CORS Origin:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  credentials: true
}));

// ----------------------------------------------------------
// ✅ IMPORTANT: Shopify App Proxy actually hits:
//    /apps/request-purchase  → forwarded to your backend
// ----------------------------------------------------------
app.use("/apps/request-purchase", requestPurchaseRouter);

// ----------------------------------------------------------
// Also allow direct access for testing
// ----------------------------------------------------------
app.use("/request-purchase", requestPurchaseRouter);

// Makes hitting the root URL show you're online
app.get("/", (_req, res) => res.send("Backend online"));

// Crash logging
process.on("uncaughtException", (err) => console.error("UNCAUGHT EX:", err));
process.on("unhandledRejection", (err) => console.error("UNHANDLED REJECTION:", err));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
  console.log("Allowed Origins:", ALLOWED_ORIGINS);
});
