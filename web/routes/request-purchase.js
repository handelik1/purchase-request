import express from "express";

const router = express.Router();

/**
 * POST /request-purchase
 * Receives:
 * recipient  -> email to send to
 * cart       -> Shopify cart.js object
 * requester  -> logged-in customer details
 * senderName -> Name user typed in modal
 * senderLocation -> Location user typed
 */
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
      requesterReceived: requester ? true : false,
      senderName,
      senderLocation
    });

    // -----------------------------
    // Validation
    // -----------------------------
    if (!recipientEmail) {
      return res.status(400).json({ success: false, error: "Recipient email missing" });
    }

    if (!senderName) {
      return res.status(400).json({ success: false, error: "Sender name missing" });
    }

    if (!senderLocation) {
      return res.status(400).json({ success: false, error: "Sender location missing" });
    }

    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      return res.status(400).json({ success: false, error: "Cart empty or invalid" });
    }

    const shop = process.env.SHOPIFY_SHOP_DOMAIN;
    const adminToken = process.env.SHOPIFY_ADMIN_API_TOKEN;

    if (!shop || !adminToken) {
      console.error("❌ Missing SHOPIFY_SHOP_DOMAIN or SHOPIFY_ADMIN_API_TOKEN");
      return res.status(500).json({ success: false, error: "Server misconfiguration" });
    }

    // -----------------------------
    // Convert cart → Draft order line items
    // -----------------------------
    const line_items = cart.items.map((item) => {
      const variantId = Number(item.variant_id || item.id || null);
      return {
        variant_id: variantId,
        quantity: Number(item.quantity) || 1
      };
    });

    // -----------------------------
    // Build Requester Address
    // -----------------------------
    const address =
      requester && requester.email
        ? {
            first_name: requester.first_name || undefined,
            last_name: requester.last_name || undefined,
            address1: requester.address1 || undefined,
            address2: requester.address2 || undefined,
            city: requester.city || undefined,
            province: requester.province || undefined,
            zip: requester.zip || undefined,
            country: requester.country || undefined
          }
        : undefined;

    // -----------------------------
    // Draft Order Body
    // -----------------------------
    const draftOrderBody = {
      draft_order: {
        line_items,
        email: requester?.email || recipientEmail,
        billing_address: address,
        shipping_address: address,
        use_customer_default_address: false
      }
    };

    console.log("🛒 Draft Order Payload:", draftOrderBody);

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
      console.error("❌ Draft order NOT created:", resp.status, errorText);
      return res.status(500).json({
        success: false,
        error: "Shopify draft order creation failed",
        details: errorText
      });
    }

    const data = await resp.json();
    const draft = data.draft_order;
    const invoice_url = draft.invoice_url;

    console.log("✅ Draft order created:", draft.id);

    // -----------------------------
    // Build Email (NO cart items)
    // -----------------------------
    const addressHtml = address
      ? `
        ${address.first_name || ""} ${address.last_name || ""}<br>
        ${address.address1 || ""}<br>
        ${address.address2 || ""}<br>
        ${address.city || ""}, ${address.province || ""} ${address.zip || ""}<br>
        ${address.country || ""}
      `
      : "No shipping address provided.";

    const html = `
      <h2>Purchase Request</h2>
      <p><strong>${senderName}</strong> from <strong>${senderLocation}</strong> is asking you to complete a purchase.</p>

      <h3>Shipping Information</h3>
      <p>${addressHtml}</p>

      <p>
        <a href="${invoice_url}"
           style="padding:12px 18px;background:#000;color:#fff;border-radius:6px;text-decoration:none;">
          Approve & Pay
        </a>
      </p>

      <p>If the button doesn't work, open this link:<br>
      <a href="${invoice_url}">${invoice_url}</a></p>
    `;

    // -----------------------------
    // Send Email via Mailgun
    // -----------------------------
    const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
    const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
    const MAILGUN_BASE = process.env.MAILGUN_BASE_URL || "https://api.mailgun.net/v3";

    if (MAILGUN_API_KEY && MAILGUN_DOMAIN) {
      const mailUrl = `${MAILGUN_BASE}/${MAILGUN_DOMAIN}/messages`;
      const auth = Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64");

      const form = new URLSearchParams();
      form.append(
        "from",
        process.env.FROM_EMAIL || `Purchase Request <support@${MAILGUN_DOMAIN}>`
      );
      form.append("to", recipientEmail);
      form.append(
        "subject",
        `Purchase request from ${senderName}`
      );
      form.append("html", html);

      const mailResp = await fetch(mailUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: form.toString()
      });

      if (!mailResp.ok) {
        console.error("❌ Mailgun Error:", await mailResp.text());
      } else {
        console.log("📧 Email successfully sent to:", recipientEmail);
      }
    } else {
      console.warn("⚠️ Mailgun disabled: missing keys.");
    }

    // -----------------------------
    // Final Response
    // -----------------------------
    return res.json({
      success: true,
      draft_id: draft.id,
      invoice_url
    });

  } catch (err) {
    console.error("🔥 Server Error:", err);
    if (!res.headersSent)
      return res.status(500).json({
        success: false,
        error: err.message || "Server crashed"
      });
  }
});

export default router;
