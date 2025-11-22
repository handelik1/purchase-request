import express from "express";
import nodemailer from "nodemailer";

const router = express.Router();

// Configure your SMTP transporter
const transporter = nodemailer.createTransport({
  service: "gmail", // or another provider like SendGrid/SMTP
  auth: {
    user: process.env.EMAIL_USER, // your email
    pass: process.env.EMAIL_PASS, // app password if using Gmail
  },
});

router.post("/", async (req, res) => {
  const { email, cart } = req.body;

  // Respond immediately to Shopify to avoid 504 timeout
  res.json({ success: true });

  // Send the email asynchronously
  try {
    console.log("Sending email to:", email);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Purchase Request",
      text: "Hello",
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
  } catch (err) {
    console.error("Error sending email:", err);
  }
});

export default router;
