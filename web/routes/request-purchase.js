// routes/request-purchase.js
import express from "express";

const router = express.Router();

/**
 * POST /request-purchase
 * Body: { email: string, cart: object }
 *
 * - Responds immediately to Shopify (avoids 504)
 * - Sends email via Mailgun in background
 */
router.post("/", async (req, res) => {
  try {
    const { email, cart } = req.body ?? {};
    const shop = req.query.shop || process.env.SHOPIFY_SHOP_DOMAIN;

    console.log("Incoming request-purchase:", { email, cart, shop });

    if (!email) {
      return res.status(400).json({ success: false, error: "Missing email" });
    }

    if (!shop) {
      console.warn("Missing shop query param");
    }

    // Respond to Shopify immediately
    res.json({ success: true });

    // --------------------------------------------
    //   BACKGROUND EMAIL SEND (non-blocking)
    // --------------------------------------------
    (async () => {
      try {
        const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
        const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
        const MAILGUN_BASE_URL = process.env.MAILGUN_BASE_URL || "https://api.mailgun.net/v3";

        if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
          console.error("Mailgun config missing");
          return;
        }

        // Extract items safely
        const items = Array.isArray(cart?.items) ? cart.items : [];

        // Create readable text list
        const itemLines = items.length
          ? items.map(i => `• ${i.title} (qty: ${i.quantity})`).join("\n")
          : "Cart is empty.";

        // Build checkout URL
        const lineItems = items
          .map(i => `${i.variant_id}:${i.quantity}`)
          .join(",");

        const checkoutUrl =
          items.length
            ? `https://${shop}/cart/${lineItems}`
            : `https://${shop}/cart`;

        // Build HTML email
        const htmlBody = `
          <h2>Purchase Request</h2>
          <p>The following items were requested:</p>

          <ul>
            ${items.map(i =>
              `<li>${i.title} — qty: ${i.quantity}</li>`
            ).join("")}
          </ul>

          <p>
            <a href="${checkoutUrl}"
               style="display:inline-block;padding:12px 18px;background:#000;color:#fff;
                      text-decoration:none;border-radius:6px;">
              Complete Purchase
            </a>
          </p>
        `;

        // Mailgun request
        const url = `${MAILGUN_BASE_URL}/${MAILGUN_DOMAIN}/messages`;
        const auth = Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64");

        const form = new URLSearchParams();
        form.append("from", `support@extremedigital.net`);
        form.append("to", email);
        form.append("subject", `Purchase Request from ${shop}`);
        form.append("text", itemLines + `\n\nCheckout here:\n${checkoutUrl}`);
        form.append("html", htmlBody);

        console.log("Sending Mailgun request →", url);

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
          console.error("Mailgun returned error:", resp.status, json);
        } else {
          console.log("Mailgun send success:", json);
        }

      } catch (err) {
        console.error("Mailgun send error:", err);
      }
    })();

  } catch (err) {
    console.error("Request handler fatal error:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
});

export default router;
