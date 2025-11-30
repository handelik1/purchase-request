// web/routes/request-purchase.js
import express from "express";

const router = express.Router();

// helper: search customer by email via Admin API
async function findCustomerByEmail(shop, adminToken, email) {
  const url = `https://${shop}/admin/api/2024-10/customers/search.json?query=email:${encodeURIComponent(email)}`;
  const r = await fetch(url, {
    method: "GET",
    headers: {
      "X-Shopify-Access-Token": adminToken,
      "Content-Type": "application/json",
    },
  });
  if (!r.ok) {
    const text = await r.text().catch(() => null);
    console.error("Customer search failed:", r.status, text);
    return null;
  }
  const data = await r.json().catch(() => null);
  if (!data || !Array.isArray(data.customers) || data.customers.length === 0) return null;
  return data.customers[0]; // return first match
}

router.post("/", async (req, res) => {
  try {
    const { email: recipientEmail, cart, requester } = req.body ?? {};
    console.log("Incoming request-purchase:", { recipientEmail, cart, requester });

    if (!recipientEmail) return res.status(400).json({ success: false, error: "Missing recipient email" });
    if (!cart?.items?.length) return res.status(400).json({ success: false, error: "Cart empty or missing" });

    const shop = process.env.SHOPIFY_SHOP_DOMAIN;
    const adminToken = process.env.SHOPIFY_ADMIN_API_TOKEN;

    if (!shop || !adminToken) {
      console.error("Missing SHOPIFY_SHOP_DOMAIN or SHOPIFY_ADMIN_API_TOKEN");
      return res.status(500).json({ success: false, error: "Server misconfigured" });
    }

    // Try to find existing customer by requester email (A3: do not create)
    let customer = null;
    if (requester && requester.email) {
      try {
        customer = await findCustomerByEmail(shop, adminToken, requester.email);
        console.log("Customer search result:", customer ? customer.id : "not found");
      } catch (err) {
        console.error("Customer search exception:", err);
        customer = null;
      }
    } else {
      console.log("No requester email provided; skipping customer search.");
    }

    // Build line_items for draft order
    const line_items = cart.items.map((it) => ({
      variant_id: Number(it.variant_id || it.id),
      quantity: Number(it.quantity || 1),
    }));

    // Build shipping/billing address from requester (if provided)
    const buildAddress = (r) => r ? {
      first_name: r.first_name || "",
      last_name: r.last_name || "",
      address1: r.address1 || "",
      address2: r.address2 || "",
      city: r.city || "",
      province: r.province || "",
      province_code: r.province_code || "",
      zip: r.zip || "",
      country: r.country || "",
      country_code: r.country_code || "",
      phone: r.phone || ""
    } : undefined;

    const shipping_address = buildAddress(requester);
    const billing_address = buildAddress(requester);

    // Draft order payload
    const draft_order = {
      line_items,
      use_customer_default_address: false,
      shipping_address,
      billing_address,
      email: requester?.email || ""
    };

    // If a matching customer was found, attach customer (A3: use existing only)
    if (customer && customer.id) {
      // Shopify expects "customer" or "customer_id". Use "customer" object with id.
      draft_order.customer = { id: customer.id };
    } else {
      // No existing customer found; we will proceed without attaching a customer.
      // Note: without an attached customer, some storefront behavior may fallback (logged-in user's address).
      console.warn("No existing customer matched requester email. Draft order will be created without customer.");
    }

    const payload = { draft_order };

    // Create the draft order
    const url = `https://${shop}/admin/api/2024-10/draft_orders.json`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": adminToken
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const text = await resp.text().catch(()=>null);
      console.error("Draft order creation failed:", resp.status, text);
      return res.status(500).json({ success: false, error: "Draft order creation failed", details: text });
    }

    const data = await resp.json();
    const draft = data.draft_order;
    const invoice_url = draft?.invoice_url || null;
    console.log("Draft created:", { id: draft?.id, invoice_url });

    // Build email HTML
    const itemsHtml = cart.items.map(i => `<li>${i.title} (qty: ${i.quantity})</li>`).join("");
    const addrHtml = requester ? `
      ${requester.first_name || ""} ${requester.last_name || ""}<br>
      ${requester.address1 || ""} ${requester.address2 || ""}<br>
      ${requester.city || ""}, ${requester.province || ""} ${requester.zip || ""}<br>
      ${requester.country || ""}<br>
    ` : "No requester address provided.";

    const html = `
      <h2>Purchase Request</h2>
      <p>Cart:</p><ul>${itemsHtml}</ul>
      <p><b>Requester shipping address:</b></p>
      <p>${addrHtml}</p>
      <p>
        <a href="${invoice_url}" style="display:inline-block;padding:12px 18px;background:#000;color:#fff;border-radius:6px;text-decoration:none;">
          Approve & Pay
        </a>
      </p>
      <p>If the above button does not work, open: ${invoice_url}</p>
    `;

    // send email via Mailgun (raw HTTP)
    const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
    const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
    const MAILGUN_BASE = process.env.MAILGUN_BASE_URL || "https://api.mailgun.net/v3";

    if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
      console.error("Missing Mailgun config");
      return res.status(500).json({ success: false, error: "Mailgun not configured" });
    }

    const mailUrl = `${MAILGUN_BASE}/${MAILGUN_DOMAIN}/messages`;
    const auth = Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64");
    const form = new URLSearchParams();
    form.append("from", process.env.FROM_EMAIL || `Purchase Request <mail@${MAILGUN_DOMAIN}>`);
    form.append("to", recipientEmail);
    form.append("subject", `Purchase request from ${requester?.first_name || "Customer"}`);
    form.append("html", html);
    form.append("text", `Approve & Pay: ${invoice_url}`);

    const mailResp = await fetch(mailUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form.toString()
    });

    if (!mailResp.ok) {
      const mt = await mailResp.text().catch(()=>null);
      console.error("Mailgun error:", mailResp.status, mt);
    } else {
      console.log("Mailgun email sent to", recipientEmail);
    }

    return res.json({ success: true, draft_id: draft?.id, invoice_url, customer_attached: !!customer });

  } catch (err) {
    console.error("Request handler exception:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
