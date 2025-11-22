// routes/request-purchase.js
import express from "express";
const router = express.Router();

// POST /request-purchase
router.post("/", async (req, res) => {
  try {
    const { email, cart } = req.body;
    console.log("Received request:", { email, cart });

    // TODO: send email or save to DB here
    // For now just return success
    res.json({ success: true });
  } catch (err) {
    console.error("Error handling request:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
