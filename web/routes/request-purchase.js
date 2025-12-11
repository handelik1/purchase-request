import express from "express";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const recipientEmail = req.body?.recipient || req.body?.email;
    const cart = req.body?.cart;
    const requester = req.body?.requester;
    const senderName = req.body?.senderName;
    const senderLocation = req.body?.senderLocation;

    console.log("📥 Incoming /request-purchase request", {
      recipientEmail,
      cartItems: cart?.items?.length || 0,
      requesterReceived: !!requester,
      senderName,
      senderLocation
    });

    // Validation
    if (!recipientEmail) return res.status(400).json({ success: false, error: "Recipient email missing" });
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0)
      return res.status(400).json({ success: false, error: "Cart empty or invalid" });
    if (!senderName || !senderLocation)
      return res.status(400).json({ success: false, error: "Sender name or location missing" });

    const shop = process.env.SHOPIFY_SHOP_DOMAIN;
    const adminToken = process.env.SHOPIFY_ADMIN_API_TOKEN;

    if (!shop || !adminToken) {
      return res.status(500).json({ success: false, error: "Server misconfiguration" });
    }


    // Convert cart.js -> Draft Order line items WITH CUSTOM PROPERTIES
    // ------------------------------------------
    const line_items = cart.items.map(item => ({
      variant_id: Number(item.variant_id || item.id),
      quantity: Number(item.quantity || 1),
      properties: item.properties
        ? Object.entries(item.properties).map(([key, value]) => ({
            name: key,
            value: String(value)
          }))
        : []
    }));


    // Address mapping
    const address = requester?.email
      ? {
          first_name: requester.first_name,
          last_name: requester.last_name,
          address1: requester.address1,
          address2: requester.address2,
          city: requester.city,
          province: requester.province,
          zip: requester.zip,
          country: requester.country
        }
      : undefined;

    // Draft Order body
    const draftOrderBody = {
      draft_order: {
        line_items,
        email: requester?.email || recipientEmail,
        billing_address: address,
        shipping_address: address,
        use_customer_default_address: false
      }
    };

    const url = `https://${shop}/admin/api/2025-01/draft_orders.json`;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": adminToken
      },
      body: JSON.stringify(draftOrderBody)
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error("❌ Draft order failed:", resp.status, errorText);
      return res.status(500).json({ success: false, error: "Shopify draft order failed", details: errorText });
    }

    const data = await resp.json();
    const draft = data.draft_order;
    const invoice_url = draft.invoice_url;

    // ------------------------------------------
    // Email Content (NO CART DETAILS)
    // ------------------------------------------
    const html = `
      <h2>Purchase Request</h2>
      <p>${senderName} from ${senderLocation} is requesting you to complete a purchase.</p>

      <p>
        <a href="${invoice_url}" 
           style="padding:12px 18px;background:#000;color:#fff;border-radius:6px;text-decoration:none;">
          Approve & Pay
        </a>
      </p>

      <p>If the button doesn't work, open this link:<br>
      <a href="${invoice_url}">${invoice_url}</a></p>
    `;

    // ------------------------------------------
    // Mailgun Email
    // ------------------------------------------
    const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
    const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
    const MAILGUN_BASE = process.env.MAILGUN_BASE_URL || "https://api.mailgun.net/v3";

    if (MAILGUN_API_KEY && MAILGUN_DOMAIN) {
      const mailUrl = `${MAILGUN_BASE}/${MAILGUN_DOMAIN}/messages`;
      const auth = Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64");

      const form = new URLSearchParams();
      form.append("from", process.env.FROM_EMAIL || `Purchase Request <support@${MAILGUN_DOMAIN}>`);
      form.append("to", recipientEmail);
      form.append("subject", `Purchase request from ${senderName}`);
      form.append("html", html);

      const mailResp = await fetch(mailUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: form.toString()
      });

      if (!mailResp.ok) console.error("❌ Mailgun Error:", await mailResp.text());
      else console.log("📧 Email sent →", recipientEmail);
    }

    // Final response
    return res.json({ success: true, draft_id: draft.id, invoice_url });

  } catch (err) {
    console.error("🔥 Server Error:", err);
    if (!res.headersSent) res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
