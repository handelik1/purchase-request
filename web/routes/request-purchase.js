// /web/routes/request-purchase.js
import express from "express";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { email, cart, address } = req.body || {};

    console.log("Incoming request:", { email, cart, address });

    if (!email || !cart) {
      return res.status(400).json({ success: false, error: "Missing email or cart" });
    }

    // Respond immediately to Shopify
    res.json({ success: true });

    // --------------------------
    // BACKGROUND EMAIL PROCESS
    // --------------------------
    (async () => {
      try {
        const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
        const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;

        if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
          console.error("Mailgun config missing!");
          return;
        }

        // Build Shopify cart string: variant:qty, variant:qty
        const cartList = cart.items
          .map(i => `${i.variant_id || i.id}:${i.quantity}`)
          .join(",");

        // Build checkout parameters
        const params = new URLSearchParams();

        // Email
        params.append("checkout[email]", address?.email || "");

        // Shipping fields
        if (address) {
          params.append("checkout[shipping_address][first_name]", address.first_name || "");
          params.append("checkout[shipping_address][last_name]", address.last_name || "");
          params.append("checkout[shipping_address][address1]", address.address1 || "");
          params.append("checkout[shipping_address][address2]", address.address2 || "");
          params.append("checkout[shipping_address][city]", address.city || "");
          params.append("checkout[shipping_address][province]", address.province || "");
          params.append("checkout[shipping_address][zip]", address.zip || "");
          params.append("checkout[shipping_address][country]", address.country || "");
        }

        const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;

        const checkoutUrl =
          `https://${shopDomain}/cart/${cartList}?` + params.toString();

        // Build email HTML
        const cartHtml =
          cart.items
            .map(i =>
              `<li>${i.title} (qty: ${i.quantity}) — ${i.final_line_price}</li>`
            )
            .join("");

        const htmlBody = `
          <h2>New Purchase Request</h2>

          <h3>Cart:</h3>
          <ul>${cartHtml}</ul>

          <h3>Requester Shipping Address:</h3>
          ${
            address
              ? `
              ${address.first_name || ""} ${address.last_name || ""}<br>
              ${address.address1 || ""}<br>
              ${address.address2 || ""}<br>
              ${address.city || ""}, ${address.province || ""} ${address.zip || ""}<br>
              ${address.country || ""}<br>
              `
              : "No address provided."
          }

          <br><br>

          <a href="${checkoutUrl}"
             style="padding:14px 22px; background:#000; color:#fff; text-decoration:none; border-radius:8px; display:inline-block;">
            Complete Purchase
          </a>
        `;

        // Mailgun API call
        const url = `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`;

        const form = new URLSearchParams();
        form.append("from", `Purchase Request <support@extremedigital.net>`);
        form.append("to", email);
        form.append("subject", "New Purchase Request");
        form.append("html", htmlBody);

        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization:
              "Basic " + Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form.toString(),
        });

        const data = await response.json();
        console.log("Mailgun response:", data);

      } catch (err) {
        console.error("Mailgun send error:", err);
      }
    })();

  } catch (err) {
    console.error("Handler error:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
});

export default router;
