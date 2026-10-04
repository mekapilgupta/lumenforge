import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
let url = '', anonKey = '', rzpKey = '', rzpSecret = '';
for (const line of env.split('\n')) {
  if (line.startsWith('PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim().replace(/['"]/g, '');
  if (line.startsWith('PUBLIC_SUPABASE_ANON_KEY=')) anonKey = line.split('=')[1].trim().replace(/['"]/g, '');
  if (line.startsWith('RAZORPAY_KEY_ID=')) rzpKey = line.split('=')[1].trim().replace(/['"]/g, '');
  if (line.startsWith('RAZORPAY_KEY_SECRET=')) rzpSecret = line.split('=')[1].trim().replace(/['"]/g, '');
}

console.log('URL:', url, 'anonKey length:', anonKey.length, 'rzpKey:', rzpKey);

async function checkRazorpay() {
  const authHeader = 'Basic ' + Buffer.from(`${rzpKey}:${rzpSecret}`).toString('base64');
  const res = await fetch(`https://api.razorpay.com/v1/payments/pay_TjqULwdAnnV5un`, {
    headers: { Authorization: authHeader }
  });
  const data = await res.json();
  console.log('Razorpay Payment details for pay_TjqULwdAnnV5un:');
  console.log('Amount:', data.amount, 'Currency:', data.currency, 'Status:', data.status, 'Method:', data.method);
  console.log('Full RZP data:', JSON.stringify(data, null, 2));
}

checkRazorpay();
