import { resolveVariantSku } from '../src/lib/server/variants.js';

// Let's test resolving variant for MIAMI-3 BEIGE size 38 vs size 40
const pId = '2a744ffe-8838-4d7f-8825-52577ce737fd';

const res38 = await resolveVariantSku(pId, 38, 'BEIGE');
console.log("Resolved Size 38:", res38);

const res40 = await resolveVariantSku(pId, 40, 'BEIGE');
console.log("Resolved Size 40:", res40);

const res37 = await resolveVariantSku(pId, 37, 'BEIGE');
console.log("Resolved Size 37:", res37);

if (res38.sku !== res40.sku && res38.sku && res40.sku) {
  console.log("✅ SUCCESS: Size 38 and Size 40 have DIFFERENT unique 8-digit SKUs!");
} else {
  console.error("❌ FAILED: SKUs are identical!");
}
