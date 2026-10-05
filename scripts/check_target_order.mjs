import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const idx = line.indexOf('=');
  if (idx > 0) {
    const k = line.substring(0, idx).trim();
    const v = line.substring(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    env[k] = v;
  }
});

const supabase = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: o, error: oErr } = await supabase.from('orders_complete').select('*').eq('id', 'a373ce87-2e88-4f7a-b299-17ccbc0f14e9').single();
  if (oErr) {
    console.error('Error fetching order:', oErr);
    return;
  }
  console.log('--- Order Current Status ---');
  console.log('Order Number:        ', o?.order_number);
  console.log('Order Status:        ', o?.status);
  console.log('Shiprocket Order ID: ', o?.shiprocket_order_id);
  console.log('Shiprocket Status:   ', o?.shiprocket_status);
  console.log('Payment Method:      ', o?.payment_method);
  console.log('Payment Status:      ', o?.payment_status);
  console.log('Total Amount (paise):', o?.total_amount);
  console.log('Advance Amount:      ', o?.advance_amount);
  console.log('COD Balance Due:     ', o?.cod_balance_due);
  console.log('Cancellation Reason: ', o?.cancellation_reason);

  const { data: queue } = await supabase.from('automation_queue').select('*').eq('order_id', 'a373ce87-2e88-4f7a-b299-17ccbc0f14e9');
  console.log('\n--- Automation Queue Tasks ---');
  console.log('Pending/Active Tasks:', queue?.length || 0);
  if (queue && queue.length > 0) {
    console.log(JSON.stringify(queue, null, 2));
  }
}

run().catch(console.error);
