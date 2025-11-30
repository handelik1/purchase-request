// web/routes/request-purchase.js
import express from "express";

const router = express.Router();

/**
 * POST /request-purchase
 * Body: { email: string (recipient), cart: object, requester: object (requester shipping/email) }
 *
 * Creates a Draft Order in Shopify, then emails the invoice_url to the recipient.
 */
router.post("/", async (req, res) => {
  try {
    const { email: recipientEmail, cart, requester } = req.body ?? {};
    console.log("Incoming request-purchase:", { recipientEmail, cart, requester });

    if (!recipientEmail) return res.status(400).json({ success: false, error: "Missing recipient email" });
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      return res.status(400).json({ success: false, error: "Cart empty or missing" });
    }

    // Respond early to Shopify so it doesn't time out (we will still await draft creation to send URL)
    // but it's OK to respond after draft creation; we create draft synchronously and then return.
    // Create Draft Order payload
    const shop = process.env.SHOPIFY_SHOP_DOMAIN;
    const adminToken = process.env.SHOPIFY_ADMIN_API_TOKEN;

    if (!shop || !adminToken) {
      console.error("Missing SHOPIFY_SHOP_DOMAIN or SHOPIFY_ADMIN_API_TOKEN");
      return res.status(500).json({ success: false, error: "Server misconfiguration" });
    }

    // Build line_items array for Draft Order (Shopify expects variant_id numeric)
    const line_items = cart.items.map((it) => {
      // Variant ID in cart may be an integer or string. Shopify Admin API expects numeric variant_id.
      // If you have variant_id available (recommended), use it. If only product_id present you'll need variant selection.
      return {
        variant_id: Number(it.variant_id || it.id), // force number
        quantity: Number(it.quantity || 1),
        // optional: price: (it.price / 100).toFixed(2) — only if you want to override price
      };
    });

    // Build request body per Shopify DraftOrder API
    const draftOrderBody = {
      draft_order: {
        line_items,
        email: requester?.email || requester?.email_address || requester?.customer_email || "",
        billing_address: requester ? {
          first_name: requester.first_name || "",
          last_name: requester.last_name || "",
          address1: requester.address1 || "",
          address2: requester.address2 || "",
          city: requester.city || "",
          province: requester.province || "",
          zip: requester.zip || "",
          country: requester.country || ""
        } : undefined,
        shipping_address: requester ? {
          first_name: requester.first_name || "",
          last_name: requester.last_name || "",
          address1: requester.address1 || "",
          address2: requester.address2 || "",
          city: requester.city || "",
          province: requester.province || "",
          zip: requester.zip || "",
          country: requester.country || ""
        } : undefined,
        // Optional: note, tags, applied_discount etc.
        // You can set use_customer_default_address: false to ensure these addresses are used.
        use_customer_default_address: false
      }
    };

    // Create Draft Order via Admin REST API
    const url = `https://${shop}/admin/api/2024-10/draft_orders.json`; // API version can be updated
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": adminToken
      },
      body: JSON.stringify(draftOrderBody)
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("Draft order creation failed:", resp.status, text);
      return res.status(500).json({ success: false, error: "Draft order creation failed", details: text });
    }

    const data = await resp.json();
    const draft = data.draft_order;
    console.log("Draft order created:", draft && draft.id);

    // The invoice_url is what you send to the approver to complete and pay
    const invoice_url = draft && draft.invoice_url;
    if (!invoice_url) {
      console.error("No invoice_url on draft order response:", draft);
    }

    // Build email HTML with invoice link
    const cartHtml = cart.items.map(i => `<li>${i.title} (qty: ${i.quantity})</li>`).join("");
    const addressHtml = requester ? `
      ${requester.first_name || ""} ${requester.last_name || ""}<br>
      ${requester.address1 || ""}<br>
      ${requester.address2 || ""}<br>
      ${requester.city || ""}, ${requester.province || ""} ${requester.zip || ""}<br>
      ${requester.country || ""}<br>
      ` : "No address provided.";

    const html = `
      <h2>Purchase Request</h2>
      <p>Cart:</p>
      <ul>${cartHtml}</ul>
      <p>Requester shipping address:</p>
      <p>${addressHtml}</p>
      <p>
        <a href="${invoice_url}" style="display:inline-block;padding:12px 18px;background:#000;color:#fff;border-radius:6px;text-decoration:none;">
          Approve & Pay
        </a>
      </p>
      <p>Or open this URL in your browser: <a href="${invoice_url}">${invoice_url}</a></p>
    `;

    // Send email with Mailgun
    const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
    const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
    const MAILGUN_BASE = process.env.MAILGUN_BASE_URL || "https://api.mailgun.net/v3";

    if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
      console.error("Missing Mailgun config");
      return res.status(500).json({ success: false, error: "Mail config missing" });
    }

    const mailUrl = `${MAILGUN_BASE}/${MAILGUN_DOMAIN}/messages`;
    const auth = Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64");
    const mailForm = new URLSearchParams();
    mailForm.append("from", process.env.FROM_EMAIL || `Purchase Request <support@${MAILGUN_DOMAIN}>`);
    mailForm.append("to", recipientEmail);
    mailForm.append("subject", `Purchase request from ${requester?.first_name || 'Customer'}`);
    mailForm.append("html", html);
    mailForm.append("text", `Purchase request - open invoice: ${invoice_url}`);

    const mailResp = await fetch(mailUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: mailForm.toString()
    });

    if (!mailResp.ok) {
      const txt = await mailResp.text().catch(()=>null);
      console.error("Mailgun send failed:", mailResp.status, txt);
    } else {
      console.log("Email sent via Mailgun to", recipientEmail);
    }

    // Return success to Shopify
    return res.json({ success: true, draft_id: draft && draft.id, invoice_url });

  } catch (err) {
    console.error("Request handler error:", err);
    if (!res.headersSent) return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
