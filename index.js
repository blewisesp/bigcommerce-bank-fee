const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const STORE_HASH = process.env.STORE_HASH;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const BC_API_BASE = `https://api.bigcommerce.com/stores/${STORE_HASH}/v3`;

const headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'X-Auth-Token': ACCESS_TOKEN,
};

// Health check
app.get('/', (req, res) => res.send('Bank fee server is running!'));

// Add the $50 bank deposit fee
app.post('/add-bank-fee', async (req, res) => {
  const { checkoutId } = req.body;
  console.log('Received checkoutId:', checkoutId);
  console.log('Store hash:', STORE_HASH);
  if (!checkoutId) return res.status(400).json({ error: 'checkoutId required' });

  try {
    const url = `${BC_API_BASE}/checkouts/${checkoutId}/fees`;
    console.log('Calling URL:', url);
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fees: [{
          name: 'bank_deposit_fee',
          type: 'custom_fee',
          display_name: 'Bank Transfer Fee',
          cost: '50.00',
          source: 'Bank Deposit Fee',
        }]
      }),
    });
    const text = await response.text();
    console.log('BigCommerce response:', text);
    res.status(response.ok ? 200 : 400).json(JSON.parse(text));
  } catch (err) {
    console.log('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Remove the fee when a different payment method is chosen
app.delete('/remove-bank-fee', async (req, res) => {
  const { checkoutId } = req.body;
  console.log('Received checkoutId for removal:', checkoutId);
  if (!checkoutId) return res.status(400).json({ error: 'checkoutId required' });

  try {
    const listRes = await fetch(`${BC_API_BASE}/checkouts/${checkoutId}/fees`, { headers });
    const { data: fees } = await listRes.json();
    console.log('Current fees:', JSON.stringify(fees));
    const bankFee = fees?.find(f => f.name === 'bank_deposit_fee');
    if (!bankFee) return res.json({ message: 'No fee to remove' });

    const delRes = await fetch(`${BC_API_BASE}/checkouts/${checkoutId}/fees/${bankFee.id}`, {
      method: 'DELETE',
      headers,
    });
    res.status(delRes.ok ? 200 : 400).json({ message: 'Fee removed' });
  } catch (err) {
    console.log('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
