import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
let url = '', anonKey = '';
for (const line of env.split('\n')) {
  if (line.startsWith('PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim().replace(/['"]/g, '');
  if (line.startsWith('PUBLIC_SUPABASE_ANON_KEY=')) anonKey = line.split('=')[1].trim().replace(/['"]/g, '');
}

async function fixOrder() {
  const updatePayload = {
    payment_method: 'cod',
    payment_status: 'partial_paid',
    advance_amount: 500,
    cod_balance_due: 319100
  };

  const res = await fetch(`${url}/rest/v1/orders?order_number=eq.FT2610042484`, {
    method: 'PATCH',
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(updatePayload)
  });

  const data = await res.json();
  console.log('Update result:', JSON.stringify(data, null, 2));
}

fixOrder();
