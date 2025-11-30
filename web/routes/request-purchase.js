// web/routes/request-purchase.js
import express from "express";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { email: recipientEmail, cart, requester } = req.body;
    console.log("Incoming request-purchase:", { recipientEmail, cart, requester });

    if (!recipientEmail)
      return res.status(400).json({ success: false, error: "Missing recipient email" });

    if (!cart?.items?.length)
      return res.status(400).json({ success: false, error: "Cart is empty or missing" });

    const shop = process.env.SHOPIFY_SHOP_DOMAIN;
    const adminToken = process.env.SHOPIFY_ADMIN_API_TOKEN;

    if (!shop || !adminToken) {
      console.error("Missing SHOPIFY_SHOP_DOMAIN or SHOPIFY_ADMIN_API_TOKEN");
      return res.status(500).json({ success: false, error: "Server misconfigured" });
    }

    // Convert cart items into draft order line_items
    const line_items = cart.items.map((item) => ({
      variant_id: Number(item.variant_id || item.id),
      quantity: Number(item.quantity || 1),
    }));

    // Build shipping + billing address
    const shipping_address = requester
      ? {
          first_name: requester.first_name || "",
          last_name: requester.last_name || "",
          address1: requester.address1 || "",
          address2: requester.address2 || "",
          city: requester.city || "",
          province: requester.province || "",
          zip: requester.zip || "",
          country: requester.country || "",
        }
      : undefined;

    const draftOrderBody = {
      draft_order: {
        line_items,
        email: requester?.email || requester?.email_address || "",
        shipping_address,
        billing_address: shipping_address,
        use_customer_default_address: false
      }
    };

    // Create Draft Order
    const url = `https://${shop}/admin/api/2024-10/draft_orders.json`;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": adminToken,
      },
      body: JSON.stringify(draftOrderBody),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("Draft order creation failed:", resp.status, text);
      return res.status(500).json({ success: false, error: "Draft order failed", details: text });
    }

    const data = await resp.json();
    const draft = data.draft_order;

    console.log("Draft order created:", draft.id, "Invoice:", draft.invoice_url);

    const invoice_url = draft.invoice_url;

    // EMAIL CONTENT
    const itemsHtml = cart.items
      .map((i) => `<li>${i.title} (qty: ${i.quantity})</li>`)
      .join("");

    const addr = requester
      ? `
        ${requester.first_name || ""} ${requester.last_name || ""}<br>
        ${requester.address1 || ""}<br>
        ${requester.address2 || ""}<br>
        ${requester.city || ""}, ${requester.province || ""} ${requester.zip || ""}<br>
        ${requester.country || ""}
      `
      : "No shipping address provided";

    const html = `
      <h2>Purchase Request</h2>
      <p>Cart:</p>
      <ul>${itemsHtml}</ul>

      <p><b>Requester shipping address:</b></p>
      <p>${addr}</p>

      <p>
        <a href="${invoice_url}" 
           style="display:inline-block;padding:12px 18px;background:#000;color:#fff;
                  border-radius:6px;text-decoration:none;">
          Approve & Pay
        </a>
      </p>
    `;

    // Send Mailgun email (raw HTTP API)
    const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
    const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
    const MAILGUN_BASE = process.env.MAILGUN_BASE_URL || "https://api.mailgun.net/v3";

    if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN)
      return res.status(500).json({ success: false, error: "Mailgun not configured" });

    const mailUrl = `${MAILGUN_BASE}/${MAILGUN_DOMAIN}/messages`;
    const auth = Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64");

    const form = new URLSearchParams();
    form.append("from", process.env.FROM_EMAIL || `Purchase Request <mail@${MAILGUN_DOMAIN}>`);
    form.append("to", recipientEmail);
    form.append("subject", "New Purchase Request");
    form.append("html", html);

    const mailResp = await fetch(mailUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    if (!mailResp.ok) {
      console.error("Mailgun send failed:", await mailResp.text());
    } else {
      console.log("Mailgun: email sent to", recipientEmail);
    }

    return res.json({ success: true, draft_id: draft.id, invoice_url });
  } catch (err) {
    console.error("Request handler exception:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
