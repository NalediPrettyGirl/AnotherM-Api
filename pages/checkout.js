const express = require('express');
const router = express.Router();

// Yoco Test Secret Key
const YOCO_SECRET_KEY = 'sk_test_45bc50000eD08xge47f4626a3b47';

router.post('/create', async (req, res) => {
  try {
    const { amount, currency, successUrl, cancelUrl } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    // THIS IS THE AUTHENTICATED POST TO YOCO!
    // Your backend server talks to Yoco securely using your Secret Key
    const yocoResponse = await fetch('https://payments.yoco.com/api/checkouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${YOCO_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: amount, 
        currency: currency || 'ZAR',
        successUrl: successUrl || 'http://localhost:3000/dashboard.html?payment=success',
        cancelUrl: cancelUrl || 'http://localhost:3000/list-attire.html?payment=cancel'
      })
    });

    const data = await yocoResponse.json();

    if (!yocoResponse.ok) {
      return res.status(400).json({ error: data.message || 'Failed to create checkout' });
    }

    // Send the redirect URL back to the frontend
    res.status(200).json({ 
        checkoutId: data.id,
        redirectUrl: data.redirectUrl 
    });

  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
