import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.post("/", async (req, res) => {
  const { email } = req.body ?? {};
  console.log("Incoming request-purchase:", { email });

  if (!email) {
    return res.status(400).json({ success: false, error: "Missing email" });
  }

  // Respond immediately to Shopify
  res.json({ success: true });

  // Send email in background
  (async () => {
    try {
      const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
      const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
      const FROM_EMAIL = process.env.FROM_EMAIL || `support@${MAILGUN_DOMAIN}`;

      if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
        console.error("Mailgun config missing");
        return;
      }

      const url = `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`;
      const auth = Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64");

      const form = new URLSearchParams();
      form.append("from", FROM_EMAIL);
      form.append("to", email);
      form.append("subject", `Purchase Request from store`);
      form.append("text", `Test`);

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: form.toString()
      });

      if (!resp.ok) {
        console.error("Mailgun returned error:", resp.status, await resp.text());
      } else {
        console.log("Mailgun email sent successfully");
      }

    } catch (err) {
      console.error("Mailgun send error:", err);
    }
  })();
});

export default router;
