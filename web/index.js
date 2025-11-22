// index.js
import express from "express";
import { join } from "path";
import { readFileSync } from "fs";
import serveStatic from "serve-static";
import dotenv from "dotenv";
import cors from "cors";

import shopify from "./shopify.js";
import requestPurchaseRoute from "./routes/request-purchase.js";
import productCreator from "./product-creator.js";
import PrivacyWebhookHandlers from "./privacy.js";

dotenv.config();

// --------------------
// Initialize Express
// --------------------
const app = express();

// --------------------
// Enable CORS for Shopify store
// --------------------
app.use(
  cors({
    origin: "https://testing-approval-3.myshopify.com", // your store domain
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);
app.options("*", cors());

// --------------------
// Middleware to parse JSON
// --------------------
app.use(express.json());

// --------------------
// Request Purchase Route
// --------------------
app.use("/request-purchase", requestPurchaseRoute);

// --------------------
// Shopify App Authentication & Webhooks
// --------------------
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  shopify.redirectToShopifyOrAppRoot()
);

app.post(
  shopify.config.webhooks.path,
  shopify.processWebhooks({ webhookHandlers: PrivacyWebhookHandlers })
);

// --------------------
// Shopify Authenticated API Routes
// --------------------
app.use("/api/*", shopify.validateAuthenticatedSession());

app.get("/api/products/count", async (_req, res) => {
  const client = new shopify.api.clients.Graphql({
    session: res.locals.shopify.session,
  });

  const countData = await client.request(`
    query shopifyProductCount {
      productsCount {
        count
      }
    }
  `);

  res.status(200).send({ count: countData.data.productsCount.count });
});

app.post("/api/products", async (_req, res) => {
  let status = 200;
  let error = null;

  try {
    await productCreator(res.locals.shopify.session);
  } catch (e) {
    console.log(`Failed to process products/create: ${e.message}`);
    status = 500;
    error = e.message;
  }
  res.status(status).send({ success: status === 200, error });
});

// --------------------
// Static Assets
// --------------------
app.use(shopify.cspHeaders());

const STATIC_PATH =
  process.env.NODE_ENV === "production"
    ? `${process.cwd()}/frontend/dist`
    : `${process.cwd()}/frontend/`;

app.use(serveStatic(STATIC_PATH, { index: false }));

// --------------------
// Catch-All Route
// --------------------
app.use("/*", shopify.ensureInstalledOnShop(), async (_req, res, _next) => {
  return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(
      readFileSync(join(STATIC_PATH, "index.html"))
        .toString()
        .replace("%VITE_SHOPIFY_API_KEY%", process.env.SHOPIFY_API_KEY || "")
    );
});

// --------------------
// Start Server
// --------------------
const PORT = parseInt(
  process.env.BACKEND_PORT || process.env.PORT || "3000",
  10
);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
