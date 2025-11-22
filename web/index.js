import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import requestPurchaseRoute from "./routes/request-purchase.js";

dotenv.config();

const app = express();
app.use(express.json());

// Enable CORS only if needed for testing (Shopify App Proxy won’t need it)
app.use(cors());

app.use("/request-purchase", requestPurchaseRoute);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
