import express from "express";
const router = express.Router();

/**
 * POST /request-purchase
 * Body: { email, cart, address }
 */
router.post("/", async (req, res) => {
  try {
    const { email, cart, address } = req.body ?? {};
    console.log("Incoming request:", { email, cart, address });

    if (!email) {
      return res.status(400).json({ success: false, error: "Missing email" });
    }

    // Respond instantly to Shopify proxy
    res.json({ success: true });

    // ----- BACKGROUND EMAIL SEND -----
    (async () => {
      const { MAILGUN_API_KEY, MAILGUN_DOMAIN } = process.env;
      const BASE = "https://api.mailgun.net/v3";

      if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
        console.error("Missing MAILGUN_API_KEY or MAILGUN_DOMAIN");
        return;
      }

      const auth = Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64");
      const url = `${BASE}/${MAILGUN_DOMAIN}/messages`;

      const cartLines = Array.isArray(cart?.items)
        ? cart.items
            .map(i => `• ${i.title} (qty: ${i.quantity}) - ${i.line_price}`)
            .join("\n")
        : "No cart items.";

      const addressText = address
        ? `${address.address1}\n${address.city}, ${address.province} ${address.zip}\n${address.country}`
        : "No address provided.";

      const textBody =
        `New Purchase Request:\n\n` +
        `Cart:\n${cartLines}\n\n` +
        `Requester Shipping Address:\n${addressText}\n`;

      const form = new URLSearchParams();
      form.append("from", "support@extremedigital.net");
      form.append("to", email);
      form.append("subject", "Purchase Request");
      form.append("text", textBody);

      console.log("Mailgun request →", url);

      const r = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: form.toString()
      });

      const data = await r.json().catch(() => null);

      if (!r.ok) {
        console.error("Mailgun error:", r.status, data);
      } else {
        console.log("Mailgun success:", data);
      }
    })();
    // ----- END BACKGROUND EMAIL SEND -----

  } catch (err) {
    console.error("Handler error:", err);
    if (!res.headersSent)
      res.status(500).json({ success: false, error: "Server error" });
  }
});

export default router;
