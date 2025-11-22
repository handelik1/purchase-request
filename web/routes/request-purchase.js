// routes/request-purchase.js
import express from "express";

const router = express.Router();

/**
 * POST /request-purchase
 * Body: { email: string, cart: object }
 *
 * - Responds immediately to Shopify to avoid 504
 * - Sends email via Mailgun in background
 */
router.post("/", async (req, res) => {
  try {
    const { email, cart } = req.body ?? {};
    console.log("Incoming request-purchase:", { email, cart });

    if (!email) {
      console.warn("Missing email in request");
      return res.status(400).json({ success: false, error: "Missing email" });
    }

    // Respond to Shopify immediately
    res.json({ success: true });

    // --- Background email send (do not await before responding) ---
    (async () => {
      try {
        const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
        const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
        const MAILGUN_BASE_URL = process.env.MAILGUN_BASE_URL || "https://api.mailgun.net/v3";

        if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
          console.error("Mailgun config missing: MAILGUN_API_KEY, MAILGUN_DOMAIN, or FROM_EMAIL");
          return;
        }

        const url = `${MAILGUN_BASE_URL}/${MAILGUN_DOMAIN}/messages`;
        const auth = Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64");

        // Build readable cart text
        const cartText = Array.isArray(cart?.items) && cart.items.length
          ? cart.items.map(i => `• ${i.title || i.name || "item"} — qty:${i.quantity ?? 1} price:${i.price ?? ''}`).join("\n")
          : "Cart empty or missing items";

        const form = new URLSearchParams();
        form.append("from", `support@extremedigital.net`);
        form.append("to", email);
        form.append("subject", `Purchase Request from store`);
        form.append("text", `Test`);

        console.log("Sending Mailgun request to:", url);
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: form.toString()
        });

        const json = await resp.json().catch(() => null);
        if (!resp.ok) {
          console.error("Mailgun returned non-OK:", resp.status, json);
        } else {
          console.log("Mailgun send success:", json);
        }
      } catch (err) {
        console.error("Mailgun send error:", err);
      }
    })();

  } catch (err) {
    console.error("Request handler error:", err);
    // If we haven't responded yet, ensure a response
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: "Internal error" });
    }
  }
});

export default router;
