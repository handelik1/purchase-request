import express from "express";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const recipientEmail = req.body?.email;
    const cart = req.body?.cart;
    const senderName = req.body?.senderName;
    const senderLocation = req.body?.senderLocation;

    if (!recipientEmail) {
      return res.status(400).json({ success: false, error: "Recipient email missing" });
    }

    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      return res.status(400).json({ success: false, error: "Cart empty" });
    }

    // ------------------------------------
    // BUILD CART PERMALINK
    // ------------------------------------
    const cartItems = cart.items
      .map(item => `${item.variant_id}:${item.quantity}`)
      .join(",");

    const shop = process.env.SHOPIFY_SHOP_DOMAIN;
    const cartUrl = `https://${shop}/cart/${cartItems}`;

    // ------------------------------------
    // EMAIL HTML
    // ------------------------------------
    const html = `
      <h2>Purchase Request</h2>
      <p><strong>${senderName}</strong> from <strong>${senderLocation}</strong> has requested a purchase.</p>

      <p>
        <a href="${cartUrl}"
          style="padding:12px 18px;background:#000;color:#fff;border-radius:6px;text-decoration:none;">
          Review Cart & Checkout
        </a>
      </p>

      <p>You may edit quantities, remove items, or add new items before checkout.</p>

      <p>If the button does not work:<br/>
      <a href="${cartUrl}">${cartUrl}</a></p>
    `;

    // ------------------------------------
    // SEND EMAIL (MAILGUN)
    // ------------------------------------
    const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
    const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
    const MAILGUN_BASE = process.env.MAILGUN_BASE_URL || "https://api.mailgun.net/v3";

    if (MAILGUN_API_KEY && MAILGUN_DOMAIN) {
      const auth = Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64");

      const form = new URLSearchParams();
      form.append("from", "Purchase Requests <orders@extremedigital.net>");
      form.append("to", recipientEmail);
      form.append("subject", `Purchase request from ${senderName}`);
      form.append("html", html);

      await fetch(`${MAILGUN_BASE}/${MAILGUN_DOMAIN}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: form.toString()
      });
    }

    return res.json({ success: true, cart_url: cartUrl });

  } catch (err) {
    console.error("🔥 Server Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
