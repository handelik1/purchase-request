// routes/request-purchase.js
import express from "express";
import nodemailer from "nodemailer";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { email, cart } = req.body;
    console.log("Received request:", { email, cart });

    // --- Create transporter ---
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // your Gmail address
        pass: process.env.EMAIL_PASS, // app password, NOT Gmail login password
      },
    });

    // --- Email options ---
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Purchase Request",
      text: `A customer requested a purchase. Cart contents:\n\n${JSON.stringify(cart, null, 2)}`,
    };

    // --- Send email ---
    await transporter.sendMail(mailOptions);

    console.log("Email sent to:", email);
    res.json({ success: true });

  } catch (err) {
    console.error("Error sending email:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
