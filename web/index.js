import express from "express";
import fetch from "node-fetch";
import FormData from "form-data";
import Mailgun from "mailgun.js";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

router.post("/request-purchase", async (req, res) => {
  try {
    const { approverEmail, cart, requester } = req.body;

    console.log("Incoming request:", { approverEmail, cart, requester });

    // Build line items for checkout
    const lineItems = cart.items.map(item => ({
      variantId: `gid://shopify/ProductVariant/${item.variant_id}`,
      quantity: item.quantity
    }));

    // Create Checkout via Storefront API
    const checkoutQuery = `
      mutation CreateCheckout($input: CheckoutCreateInput!) {
        checkoutCreate(input: $input) {
          checkout {
            id
            webUrl
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const checkoutInput = {
      email: requester.email, // prefill customer → auto loads shipping address
      lineItems
    };

    const storefrontRes = await fetch(process.env.STOREFRONT_API_URL, {
      method: "POST",
      headers: {
        "X-Shopify-Storefront-Access-Token": process.env.STOREFRONT_API_TOKEN,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: checkoutQuery,
        variables: { input: checkoutInput }
      })
    });

    const storefrontData = await storefrontRes.json();

    if (storefrontData.errors) {
      console.error("Checkout mutation failed:", storefrontData.errors);
      return res.status(400).json({ success: false, errors: storefrontData.errors });
    }

    const checkoutUrl = storefrontData.data.checkoutCreate.checkout.webUrl;

    // Build the email message
    const itemListHtml = cart.items
      .map(
        item => `
      <li>
        ${item.quantity} × ${item.title} — $${(item.line_price / 100).toFixed(2)}
      </li>`
      )
      .join("");

    const htmlBody = `
      <h2>Purchase Request</h2>
      <p>The following items were requested:</p>
      <ul>${itemListHtml}</ul>

      <h3>Requester Info</h3>
      <p>${requester.first_name} ${requester.last_name}<br>
      ${requester.address1} ${requester.address2}<br>
      ${requester.city}, ${requester.province} ${requester.zip}<br>
      ${requester.country}<br>
      Email: ${requester.email}</p>

      <a href="${checkoutUrl}"
        style="display:inline-block;padding:14px 20px;background:black;color:white;text-decoration:none;font-size:16px;margin-top:20px;">
        Approve & Checkout
      </a>
    `;

    // Send Mailgun Email
    const mailgun = new Mailgun(FormData).client({
      username: "api",
      key: process.env.MAILGUN_API_KEY
    });

    await mailgun.messages.create(process.env.MAILGUN_DOMAIN, {
      from: "Purchase Requests <purchase@yourdomain.com>",
      to: approverEmail,
      subject: "Purchase Request",
      html: htmlBody
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
