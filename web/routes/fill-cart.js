import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.get("/", async (req, res) => {
  const draftId = req.query.draft_id;
  if (!draftId) return res.send("Draft order missing");

  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  const adminToken = process.env.SHOPIFY_ADMIN_API_TOKEN;

  const url = `https://${shop}/admin/api/2025-01/draft_orders/${draftId}.json`;
  const draftResp = await fetch(url, {
    headers: { "X-Shopify-Access-Token": adminToken }
  });

  if (!draftResp.ok) return res.send("Cannot fetch draft order");

  const draftData = await draftResp.json();
  const draft = draftData.draft_order;

  const cart = draft.line_items.map(item => ({
    variant_id: item.variant_id,
    quantity: item.quantity,
    properties: item.properties || []
  }));

  const shipping = draft.shipping_address || {};

  res.send(`
    <script>
      const cartItems = ${JSON.stringify(cart)};
      const shipping = ${JSON.stringify(shipping)};

      async function fillCart(){
        await fetch('/cart/clear.js', { method:'POST' });

        for (const item of cartItems){
          const props = {};
          if(item.properties){
            for (const prop of item.properties){
              props[prop.name] = prop.value;
            }
          }
          await fetch('/cart/add.js', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({
              id: item.variant_id,
              quantity: item.quantity,
              properties: props
            })
          });
        }

        // persist shipping info for checkout
        localStorage.setItem('prepopulatedShipping', JSON.stringify(shipping));

        window.location.href = '/cart';
      }

      fillCart();
    </script>
  `);
});

export default router;
