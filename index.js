const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const STORE_HASH = process.env.STORE_HASH;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const BC_API_BASE = 'https://api.bigcommerce.com/stores/' + STORE_HASH + '/v3';

const headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'X-Auth-Token': ACCESS_TOKEN,
};

app.get('/', function(req, res) {
  res.send('Bank fee server is running!');
});

app.post('/list-fees', function(req, res) {
  var checkoutId = req.body.checkoutId;
  fetch(BC_API_BASE + '/checkouts/' + checkoutId, { headers: headers })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      res.json(data.data ? data.data.fees : data.fees);
    })
    .catch(function(err) {
      res.status(500).json({ error: err.message });
    });
});

app.post('/add-bank-fee', function(req, res) {
  var checkoutId = req.body.checkoutId;
  if (!checkoutId) return res.status(400).json({ error: 'checkoutId required' });
  fetch(BC_API_BASE + '/checkouts/' + checkoutId, { headers: headers })
    .then(function(r) { return r.json(); })
    .then(function(checkoutData) {
      var existingFees = checkoutData.data ? checkoutData.data.fees : checkoutData.fees;
      var alreadyExists = existingFees && existingFees.some(function(f) { return f.name === 'bank_deposit_fee'; });
      if (alreadyExists) {
        return res.json({ message: 'Fee already exists' });
      }
      return fetch(BC_API_BASE + '/checkouts/' + checkoutId + '/fees', {
        method: 'POST',
        headers: headers,
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
    })
    .then(function(response) {
      if (!response || response.message) return;
      return response.text().then(function(text) {
        console.log('Add fee response:', text);
        res.status(response.ok ? 200 : 400).json(JSON.parse(text));
      });
    })
    .catch(function(err) {
      console.log('Error:', err.message);
      res.status(500).json({ error: err.message });
    });
});

app.delete('/remove-bank-fee', function(req, res) {
  var checkoutId = req.body.checkoutId;
  if (!checkoutId) return res.status(400).json({ error: 'checkoutId required' });
  fetch(BC_API_BASE + '/checkouts/' + checkoutId, { headers: headers })
    .then(function(r) { return r.json(); })
    .then(function(checkoutData) {
      var fees = checkoutData.data ? checkoutData.data.fees : checkoutData.fees;
      console.log('Fees from API:', JSON.stringify(fees));
      var bankFees = fees && fees.filter(function(f) { return f.name === 'bank_deposit_fee'; });
      if (!bankFees || bankFees.length === 0) {
        return res.json({ message: 'No fee to remove' });
      }
      var deletePromises = bankFees.map(function(fee) {
        var deleteUrl = BC_API_BASE + '/checkouts/' + checkoutId + '/fees/' + fee.id;
        console.log('Deleting fee at:', deleteUrl);
        return fetch(deleteUrl, { method: 'DELETE', headers: headers })
          .then(function(delRes) {
            return delRes.text().then(function(text) {
              console.log('Delete status:', delRes.status, 'body:', text);
            });
          });
      });
      return Promise.all(deletePromises).then(function() {
        res.json({ message: 'Removed ' + bankFees.length + ' fee(s)' });
      });
    })
    .catch(function(err) {
      console.log('Error:', err.message);
      res.status(500).json({ error: err.message });
    });
});

app.delete('/remove-by-ids', function(req, res) {
  var checkoutId = req.body.checkoutId;
  var feeIds = req.body.feeIds;
  if (!checkoutId || !feeIds) return res.status(400).json({ error: 'checkoutId and feeIds required' });
  var deletePromises = feeIds.map(function(id) {
    return fetch(BC_API_BASE + '/checkouts/' + checkoutId + '/fees/' + id, {
      method: 'DELETE',
      headers: headers,
    });
  });
  Promise.all(deletePromises)
    .then(function() {
      res.json({ message: 'Removed ' + feeIds.length + ' fee(s)' });
    })
    .catch(function(err) {
      res.status(500).json({ error: err.message });
    });
});

var PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log('Server running on port ' + PORT);
});
