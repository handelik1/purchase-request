// routes/request-purchase.js
import express from "express";
import fetch from "node-fetch"; // ensure you have node-fetch installed

const router = express.Router();

/**
 * POST /apps/request-purchase
 * Body: { email: string, cart: object }
 *
 * - Responds immediately to Shopify to avoid 504
 * - Sends email via Mailgun in the background
 */
router.post("/", async (req, res) => {
  try {
    const { email, cart } = req.body ?? {};
    console.log("Incoming request-purchase:", { email, cart });

    if (!email) {
      console.warn("Missing email in request");
      return res.status(400).json({ success: false, error: "Missing email" });
    }

    // Respond immediately to Shopify
    res.json({ success: true });

    // --- Send Mailgun email in the background ---
    (async () => {
      try {
        const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
        const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
        const MAILGUN_BASE_URL = process.env.MAILGUN_BASE_URL || "https://api.mailgun.net/v3";
        const FROM_EMAIL = process.env.FROM_EMAIL || "support@yourdomain.com";

        if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
          console.error("Mailgun config missing: MAILGUN_API_KEY or MAILGUN_DOMAIN");
          return;
        }

        // Build cart text
        const cartText = Array.isArray(cart?.items) && cart.items.length
          ? cart.items.map(i => `• ${i.title || i.name || "item"} — qty:${i.quantity ?? 1} price:${i.price ?? ''}`).join("\n")
          : "Cart empty or missing items";

        // Mailgun form data
        const form = new URLSearchParams();
        form.append("from", FROM_EMAIL);
        form.append("to", email);
        form.append("subject", "Purchase Request from your Shopify store");
        form.append("text", "Hi");

        const url = `${MAILGUN_BASE_URL}/${MAILGUN_DOMAIN}/messages`;
        const auth = Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64");

        console.log("Sending Mailgun request to:", url);

        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form.toString(),
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
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: "Internal error" });
    }
  }
});

export default router;
