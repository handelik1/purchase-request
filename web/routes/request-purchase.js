import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.post("/request-purchase", async (req, res) => {
  const { email, cart } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, error: "Missing email" });
  }

  console.log("Preparing to send email with Mailgun…");

  try {
    const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
    const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
    const MAILGUN_BASE_URL = process.env.MAILGUN_BASE_URL || "https://api.mailgun.net/v3";

    const url = `${MAILGUN_BASE_URL}/${MAILGUN_DOMAIN}/messages`;

    // FORMAT CART TEXT
    const cartText = cart?.items
      ?.map(item => `• ${item.title} — ${item.quantity} × ${item.price}`)
      .join("\n") || "Cart was empty";

    // Mailgun payload
    const formData = new URLSearchParams();
    formData.append("from", "Purchase Requests <mailgun@" + MAILGUN_DOMAIN + ">");
    formData.append("to", email);
    formData.append("subject", "New Purchase Request");
    formData.append("text", `Test`);

    console.log("Sending Mailgun request to:", url);

    const authString = Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64");

    const mailgunResponse = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authString}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    const result = await mailgunResponse.json();
    console.log("Mailgun response:", result);

    if (!mailgunResponse.ok) {
      console.error("Mailgun error:", result);
      return res.status(500).json({ success: false, error: result.message });
    }

    return res.json({ success: true, mailgunId: result.id });

  } catch (err) {
    console.error("Mailgun/send error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
