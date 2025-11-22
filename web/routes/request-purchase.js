import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";

const router = express.Router();

// Apply CORS to this route only
router.use(
  cors({
    origin: "https://testing-approval-3.myshopify.com",
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

// OPTIONS preflight will now be handled automatically by cors()
router.post("/", async (req, res) => {
  try {
    const { email, cart } = req.body;
    console.log("Received request-purchase:", { email, cart });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Purchase Request",
      text: `Cart data:\n${JSON.stringify(cart, null, 2)}`
    });

    console.log("Email sent to:", email);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Email error:", err);
    res.status(500).json({ error: "Failed to send email" });
  }
});

export default router;
