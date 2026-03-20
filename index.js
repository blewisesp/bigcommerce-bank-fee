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

app.get('/', (req, res) => res.send('Bank fee server is running!'));

app.post('/list-fees', async (req, res) => {
  const { checkoutId } = req.body;
  try {
    const listRes = await fetch(`${BC_API_BASE}/checkouts/${checkoutId}`, { headers });
    const data = await listRes.json();
    res.json(data.data ? data.data.fees : data.fees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/add-bank-fee', async (req, res) => {
  const { checkoutId } = req.body;
  if (!checkoutId) return res.status(400).json({ error: 'checkoutId required' });
  try {
    const checkoutRes = await fetch(`${BC_API_BASE}/checkouts/${checkoutId}`, { headers });
    const checkoutData = await checkoutRes.json();
    const existingFees = checkoutData.data ? checkoutData.data.fees : checkoutData.fees;
    const alreadyExists = existingFees && existingFees.some(function(f) { return f.name === 'bank_deposit_fee'; });
    if (alreadyExists) {
      return res.json({ message: 'Fee already exists' });
    }
    const response = await fetch(`${BC_API_BASE}/checkouts/${checkoutId}/fees`, {
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
    console.log('Add fee response:', text);
    res.status(response.ok ? 200 : 400).json(JSON.parse(text));
  } catch (err) {
    console.log('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/remove-bank-fee', async (req, res) => {
  const { checkoutId } = req.body;
  if (!checkoutId) return res.status(400).json({ error: 'checkoutId required' });
  try {
    const checkoutRes = await fetch(`${BC_API_BASE}/checkouts/${checkoutId}`, { headers });
    const checkoutData = await checkoutRes.json();
    const fees = checkoutData.data ? checkoutData.data.fees : checkoutData.fees;
    console.log('Fees from API:', JSON.stringify(fees));
    const bankFees =
