import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { email: recipientEmail, cart, requester, senderName, senderLocation } = req.body;

    console.log("📥 Incoming request", {
      recipientEmail,
      items: cart?.items?.length
    });

    if (!recipientEmail || !cart?.items?.length || !senderName || !senderLocation) {
      return res.status(400).json({ success: false });
    }

    const shop = process.env.SHOPIFY_SHOP_DOMAIN;
    const token = process.env.SHOPIFY_ADMIN_API_TOKEN;

    // -----------------------------
    // LINE ITEMS (WITH PROPERTIES)
    // -----------------------------
    const line_items = cart.items.map(item => ({
      variant_id: Number(item.variant_id),
      quantity: Number(item.quantity),
      properties: item.properties
        ? Object.entries(item.properties).map(([k, v]) => ({ name: k, value: String(v) }))
        : []
    }));

    // -----------------------------
    // SHIPPING ADDRESS
    // -----------------------------
    const address = requester?.email ? {
      first_name: requester.first_name || "N/A",
      last_name: requester.last_name || "N/A",
      address1: requester.address1 || "",
      address2: requester.address2 || "",
      city: requester.city || "",
      province: requester.province || "",
      zip: requester.zip || "",
      country: requester.country || "US",
      email: requester.email
    } : undefined;

    // -----------------------------
    // CREATE DRAFT ORDER
    // -----------------------------
    const draftOrderBody = {
      draft_order: {
        line_items,
        email: requester.email,
        shipping_address: address,
        billing_address: address,
        use_customer_default_address: false,
        note: `Requested by ${senderName} (${senderLocation})`
      }
    };

    const resp = await fetch(
      `https://${shop}/admin/api/2025-01/draft_orders.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token
        },
        body: JSON.stringify(draftOrderBody)
      }
    );

    if (!resp.ok) {
      const err = await resp.text();
      console.error(err);
      return res.status(500).json({ success: false });
    }

    const draft = (await resp.json()).draft_order;

    // -----------------------------
    // EMAIL CONTENT
    // -----------------------------
    const html = `
      <h2>Purchase Request</h2>
      <p><strong>${senderName}</strong> from <strong>${senderLocation}</strong> is requesting approval.</p>
      <p>
        <a href="${draft.invoice_url}"
           style="padding:12px 18px;background:#000;color:#fff;border-radius:6px;text-decoration:none;">
          Review & Checkout
        </a>
      </p>
    `;

    // -----------------------------
    // SEND EMAIL (MAILGUN)
    // -----------------------------
    const auth = Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString("base64");
    const form = new URLSearchParams();
    form.append("from", "Order Approval <order-approval@extremedigital.net>");
    form.append("to", recipientEmail);
    form.append("subject", `Purchase request from ${senderName}`);
    form.append("html", html);

    await fetch(`${process.env.MAILGUN_BASE_URL}/${process.env.MAILGUN_DOMAIN}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form.toString()
    });

    res.json({ success: true, invoice_url: draft.invoice_url });

  } catch (err) {
    console.error("🔥 Server Error", err);
    res.status(500).json({ success: false });
  }
});

export default router;
