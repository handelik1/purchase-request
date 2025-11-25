import express from "express";

const router = express.Router();

/**
 * POST /request-purchase
 * Body: { email: string, cart: object, address: object }
 */
router.post("/", async (req, res) => {
  try {
    const { email, cart, address } = req.body ?? {};
    console.log("Incoming request-purchase:", { email, cart, address });

    if (!email) {
      return res.status(400).json({ success: false, error: "Missing email" });
    }

    // Compose cart text for email
    const cartText = Array.isArray(cart?.items) && cart.items.length
      ? cart.items.map(i => `• ${i.title || i.name} (qty: ${i.quantity ?? 1}) — ${i.price ?? ''}`).join("\n")
      : "Cart empty";

    // Build checkout URL with line items
    const shopUrl = process.env.SHOP_URL; // e.g., testing-approval-3.myshopify.com
    const checkoutBase = `https://${shopUrl}/cart`;

    const lineItems = cart.items.map(i => `${i.variant_id}:${i.quantity ?? 1}`).join(",");
    let checkoutUrl = `${checkoutBase}/${lineItems}?checkout[email]=${encodeURIComponent(email)}`;

    // Prefill shipping if available
    if (address) {
      const { address1, address2, city, province, zip, country } = address;
      const params = new URLSearchParams({
        "checkout[shipping_address][address1]": address1 || "",
        "checkout[shipping_address][address2]": address2 || "",
        "checkout[shipping_address][city]": city || "",
        "checkout[shipping_address][province]": province || "",
        "checkout[shipping_address][zip]": zip || "",
        "checkout[shipping_address][country]": country || "",
      });
      checkoutUrl += `&${params.toString()}`;
    }

    // Build HTML email
    const emailHtml = `
      <h2>New Purchase Request</h2>
      <p>Cart:</p>
      <pre>${cartText}</pre>
      <p>Requester Shipping Address:</p>
      <pre>${address ? JSON.stringify(address, null, 2) : "No address provided"}</pre>
      <a href="${checkoutUrl}" style="display:inline-block;padding:12px 20px;background:#000;color:#fff;text-decoration:none;border-radius:4px;margin-top:10px;">
        Go to Checkout
      </a>
    `;

    // --- Send via simple fetch to Mailgun API ---
    const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
    const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
    const MAILGUN_BASE_URL = process.env.MAILGUN_BASE_URL || "https://api.mailgun.net/v3";

    const url = `${MAILGUN_BASE_URL}/${MAILGUN_DOMAIN}/messages`;
    const auth = Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64");

    const form = new URLSearchParams();
    form.append("from", `support@extremedigital.net`);
    form.append("to", email);
    form.append("subject", `Purchase Request from store`);
    form.append("html", emailHtml);

    console.log("Sending email via Mailgun to:", email);

    (async () => {
      try {
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

    // Respond to Shopify immediately
    res.json({ success: true });

  } catch (err) {
    console.error("Request handler error:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: "Internal error" });
    }
  }
});

export default router;
