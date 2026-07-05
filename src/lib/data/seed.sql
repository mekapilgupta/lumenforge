-- ============================================================
-- French Toes — Seed Data
-- Run this in Supabase SQL Editor AFTER the schema is in place.
-- All monetary values in PAISE (1 INR = 100 paise).
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- PART 1: CATEGORIES (7)
-- ─────────────────────────────────────────────────────────────

INSERT INTO categories (name, slug, description, is_active, display_order)
VALUES
  ('All Slippers',     'slippers',         'Our complete collection of handcrafted slippers',      true, 1),
  ('Blossom Classics', 'blossom-classics',  'Timeless everyday slippers for every mood',            true, 2),
  ('Garden Party',     'garden-party',      'Vibrant, eye-catching party-ready designs',            true, 3),
  ('Home Luxe',        'home-luxe',         'Premium slippers for ultimate home comfort',           true, 4),
  ('Beach Days',       'beach-days',        'Quick-dry slippers for wet & outdoor use',             true, 5),
  ('Limited Edition',  'limited-edition',   'Exclusive, limited-run designer styles',               true, 6),
  ('Best Sellers',     'best-sellers',      'Our most-loved and top-rated slippers',                true, 7)
ON CONFLICT (slug) DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- PART 2: PRODUCTS (6)
-- ─────────────────────────────────────────────────────────────
-- prices in paise: ₹1799 = 179900, ₹1499 = 149900, ₹2199 = 219900
--                  ₹1299 = 129900, ₹1599 = 159900, ₹1899 = 189900

INSERT INTO products (
  slug, name, tagline, description,
  highlights, details, materials, care, shipping,
  price, original_price, gst_percent, hsn_code,
  category_id,
  colors, sizes, images,
  stock_quantity, low_stock_threshold, track_inventory,
  is_active, is_featured, is_best_seller, is_new_arrival, is_limited_edition,
  rating_avg, rating_count
)
VALUES

-- 1. Chicago ──────────────────────────────────────────────────
(
  'chicago',
  'Chicago',
  'Metropolitan elegance meets barefoot comfort',
  'The Chicago slipper brings city-chic energy to your lounging hours. Crafted with an ultra-breathable mesh upper and a cushioned anti-slip sole, this open-toe beauty moves with you — from morning coffee to afternoon garden strolls.',
  ARRAY[
    'Ultra-breathable mesh upper — perfect for hot Indian summers',
    'Durable anti-slip EVA sole with arch support',
    'Premium soft padded straps — no chafing, all-day wear',
    'Lightweight 190g — barely feel them on your feet'
  ],
  'Upper: Premium breathable mesh with soft neoprene lining. Sole: High-density EVA with anti-slip texture. Strap: Adjustable with soft padding. Insole: Memory foam cushion with floral emboss.',
  'Outer: 60% Mesh, 40% Synthetic. Insole: Memory foam + PU coating. Sole: EVA compound. All materials are vegan-friendly and skin-safe.',
  'Wipe clean with a damp cloth. Do not machine wash. Avoid prolonged direct sunlight to preserve color. Store in the breathable dust bag provided.',
  'Free shipping on orders above ₹999. Standard delivery: 5–7 business days. Express (2–3 days) available at checkout. Easy 15-day returns.',
  179900, 249900, 5, '6402',
  (SELECT id FROM categories WHERE slug = 'blossom-classics'),
  '[{"name":"Blush","hex":"#f4a7c3"},{"name":"Lavender","hex":"#c9a0dc"},{"name":"Mint","hex":"#7ecba1"},{"name":"Nude","hex":"#d4a574"}]'::jsonb,
  ARRAY['36','37','38','39','40','41','42'],
  '[
    {"url":"https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&q=80","alt":"Chicago Slipper Main","order":1},
    {"url":"https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&q=80","alt":"Chicago Slipper Side","order":2},
    {"url":"https://images.unsplash.com/photo-1512374382149-233c42b6a83b?w=800&q=80","alt":"Chicago Slipper Detail","order":3}
  ]'::jsonb,
  50, 10, true,
  true, true, true, false, false,
  4.9, 312
),

-- 2. Maxico ───────────────────────────────────────────────────
(
  'maxico',
  'Maxico',
  'Vibrant fiesta energy, every single day',
  'Inspired by the bold spirit of Mexico, the Maxico slipper bursts with color and personality. Hand-finished floral details on the strap make every pair a wearable piece of art — your summer wardrobe will never be the same.',
  ARRAY[
    'Hand-finished embroidered floral strap detail',
    'Wide toe-box design for all-day comfort',
    'Shock-absorbing thick EVA sole',
    'Available in 4 vibrant summer shades'
  ],
  'Upper: Embroidered canvas strap with foam backing. Toe-post: Wrapped soft silicone. Sole: 2cm cushioned EVA with grip texture. Weight: 210g per pair.',
  'Strap: 80% Cotton canvas, 20% Polyester embroidery thread. Sole: EVA. Toe-post: Medical-grade silicone. Vegan & skin-safe.',
  'Hand wash the fabric strap gently with mild soap. Air dry in shade. Do not tumble dry or iron.',
  'Free shipping on orders above ₹999. Standard delivery: 5–7 business days. Express available. 15-day easy returns.',
  149900, 199900, 5, '6402',
  (SELECT id FROM categories WHERE slug = 'garden-party'),
  '[{"name":"Coral","hex":"#ff7f6e"},{"name":"Peach","hex":"#ffb347"},{"name":"Gold","hex":"#d4a853"},{"name":"Blush","hex":"#f4a7c3"}]'::jsonb,
  ARRAY['36','37','38','39','40','42'],
  '[
    {"url":"https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&q=80","alt":"Maxico Slipper Main","order":1},
    {"url":"https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&q=80","alt":"Maxico Slipper Side","order":2},
    {"url":"https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=800&q=80","alt":"Maxico Slipper Detail","order":3}
  ]'::jsonb,
  50, 10, true,
  true, true, false, false, true,
  4.8, 187
),

-- 3. Milano ───────────────────────────────────────────────────
(
  'milano',
  'Milano',
  'Italian-inspired minimalism for the modern woman',
  'The Milano is our most luxurious offering — a minimalist silhouette inspired by Italian design philosophy. A single sleek strap, premium vegan leather upper, and a cloud-soft memory foam insole deliver pure, understated luxury.',
  ARRAY[
    'Premium vegan leather upper — buttery soft touch',
    'Cloud memory foam insole — sink-in comfort',
    'Italian-inspired minimal strap design',
    'Perfect for home, terraces, and weekend brunches'
  ],
  'Upper: Vegan PU leather with micro-suede lining. Sole: High-density rubber with anti-slip dots. Insole: 1cm layered memory foam. Closure: Slip-on with elastic gore insert.',
  'Upper: Vegan PU leather. Insole: Memory foam + Jersey cover. Sole: Natural rubber compound. All materials are cruelty-free.',
  'Wipe with a barely damp soft cloth. Condition vegan leather monthly with coconut oil. Store in dust bag away from heat.',
  'Free shipping on orders above ₹999. Standard: 5–7 days. Express: 2–3 days. 15-day returns with free pickup.',
  219900, NULL, 5, '6402',
  (SELECT id FROM categories WHERE slug = 'home-luxe'),
  '[{"name":"Lavender","hex":"#c9a0dc"},{"name":"Nude","hex":"#d4a574"},{"name":"White","hex":"#f5f0eb"},{"name":"Blush","hex":"#f4a7c3"},{"name":"Mint","hex":"#7ecba1"}]'::jsonb,
  ARRAY['36','37','38','39','40','41','42'],
  '[
    {"url":"https://images.unsplash.com/photo-1512374382149-233c42b6a83b?w=800&q=80","alt":"Milano Slipper Main","order":1},
    {"url":"https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&q=80","alt":"Milano Slipper Side","order":2},
    {"url":"https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&q=80","alt":"Milano Slipper Detail","order":3}
  ]'::jsonb,
  50, 10, true,
  true, true, false, false, true,
  5.0, 94
),

-- 4. Indiano ──────────────────────────────────────────────────
(
  'indiano',
  'Indiano',
  'Born from Indian summers, made for Indian women',
  'The Indiano is our bestselling slipper, designed specifically for the Indian climate. Quick-dry fabric, extra-wide footbed for all foot shapes, and our signature "Summer Sole" — engineered for hot floors, outdoor use, and those long wedding-season walks.',
  ARRAY[
    'Quick-dry fabric — wet floors & monsoon-proof',
    'Extra-wide footbed — fits all Indian foot shapes beautifully',
    'Signature Summer Sole — stays cool on hot marble & tiles',
    'Subtle meenakari-inspired strap pattern — desi chic'
  ],
  'Upper: Quick-dry Lycra blend with cotton back. Sole: Dual-density Summer Sole — cool foam top, hard rubber bottom. Strap: Elastic with fabric wrap.',
  'Upper: 70% Lycra, 30% Cotton. Insole: Cooling gel foam. Sole: Rubber compound. All dyes: OEKO-TEX certified.',
  'Machine washable at 30°C on gentle cycle. Air dry. Colors stay vibrant wash after wash.',
  'Free shipping on orders above ₹999. Standard: 5–7 days. Express: 2–3 days. 15-day returns.',
  129900, 169900, 5, '6402',
  (SELECT id FROM categories WHERE slug = 'beach-days'),
  '[{"name":"Peach","hex":"#ffb347"},{"name":"Coral","hex":"#ff7f6e"},{"name":"Gold","hex":"#d4a853"},{"name":"Mint","hex":"#7ecba1"},{"name":"Blush","hex":"#f4a7c3"}]'::jsonb,
  ARRAY['37','38','39','40','41'],
  '[
    {"url":"https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=800&q=80","alt":"Indiano Slipper Main","order":1},
    {"url":"https://images.unsplash.com/photo-1512374382149-233c42b6a83b?w=800&q=80","alt":"Indiano Slipper Side","order":2},
    {"url":"https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&q=80","alt":"Indiano Slipper Detail","order":3}
  ]'::jsonb,
  50, 10, true,
  true, true, true, false, false,
  4.9, 541
),

-- 5. Dummyano ─────────────────────────────────────────────────
(
  'dummyano',
  'Dummyano',
  'Effortlessly cute for lazy summer mornings',
  'The Dummyano is our newest arrival — a soft, airy slipper that feels like wearing a cloud. Perfect for WFH days, morning routines, and everything in between. The puffy strap is filled with recycled pillow-grade fiber for that extra softness.',
  ARRAY[
    'Puffy cloud strap — filled with recycled soft fiber',
    'Non-marking anti-static sole — safe on all floors',
    'Open-toe for breathability in the heat',
    'Arrives in a gift-ready pastel box'
  ],
  'Upper: Fabric-wrapped puffy strap. Sole: Non-marking TPR. Insole: Textile-covered foam.',
  'Strap filling: Recycled polyester fiber. Strap cover: Microfiber. Sole: TPR. Insole: Bio-based foam.',
  'Spot clean only. Air dry in shade.',
  'Free shipping on orders above ₹999. Standard: 5–7 days. Express: 2–3 days. 15-day easy returns.',
  159900, NULL, 5, '6402',
  (SELECT id FROM categories WHERE slug = 'blossom-classics'),
  '[{"name":"Lavender","hex":"#c9a0dc"},{"name":"Blush","hex":"#f4a7c3"},{"name":"Mint","hex":"#7ecba1"}]'::jsonb,
  ARRAY['36','37','38','39','40'],
  '[
    {"url":"https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&q=80","alt":"Dummyano Slipper Main","order":1},
    {"url":"https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=800&q=80","alt":"Dummyano Slipper Side","order":2},
    {"url":"https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&q=80","alt":"Dummyano Slipper Detail","order":3}
  ]'::jsonb,
  50, 10, true,
  true, false, false, true, false,
  4.7, 62
),

-- 6. Loremano ─────────────────────────────────────────────────
(
  'loremano',
  'Loremano',
  'Bold textures, breezy soul',
  'The Loremano makes a statement with its textured basket-weave strap and bold color palette. Handwoven rattan-inspired detailing gives these slippers a premium artisanal feel — perfect for rooftop brunches, poolside afternoons, and summer getaways.',
  ARRAY[
    'Handwoven rattan-inspired basket-weave strap',
    'Premium cushioned footbed with arch contouring',
    'Bold statement colors for the confident woman',
    'Limited run — only 500 pairs per color made'
  ],
  'Upper: Woven polyester resin strap with leather-feel edges. Sole: Rubber compound. Insole: Contoured cork + foam.',
  'Strap: Woven polyester. Edges: PU leather trim. Insole: Cork + memory foam. Sole: Natural rubber.',
  'Wipe with dry cloth only. Keep away from water. Store in a cool, dry place.',
  'Free shipping on orders above ₹999. Standard: 5–7 days. Express: 2–3 days. 15-day returns.',
  189900, 229900, 5, '6402',
  (SELECT id FROM categories WHERE slug = 'garden-party'),
  '[{"name":"Coral","hex":"#ff7f6e"},{"name":"Peach","hex":"#ffb347"},{"name":"Nude","hex":"#d4a574"},{"name":"Gold","hex":"#d4a853"}]'::jsonb,
  ARRAY['37','38','39','40','41','42'],
  '[
    {"url":"https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&q=80","alt":"Loremano Slipper Main","order":1},
    {"url":"https://images.unsplash.com/photo-1512374382149-233c42b6a83b?w=800&q=80","alt":"Loremano Slipper Side","order":2},
    {"url":"https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=800&q=80","alt":"Loremano Slipper Detail","order":3}
  ]'::jsonb,
  50, 10, true,
  true, false, false, false, true,
  4.8, 128
)

ON CONFLICT (slug) DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- PART 3: SHIPPING ZONES (6)
-- ─────────────────────────────────────────────────────────────
-- All charges in paise

INSERT INTO shipping_zones (name, states, base_charge, per_kg_charge, free_shipping_threshold, estimated_days_min, estimated_days_max, cod_available, cod_charge)
VALUES
  (
    'Metro Cities',
    ARRAY['Delhi','Maharashtra','Karnataka','Tamil Nadu','Telangana','West Bengal'],
    4900, 0, 99900, 3, 5, true, 4900
  ),
  (
    'North India',
    ARRAY['Uttar Pradesh','Rajasthan','Haryana','Punjab','Himachal Pradesh','Uttarakhand','Jammu and Kashmir','Chandigarh'],
    5900, 0, 99900, 4, 6, true, 4900
  ),
  (
    'South India',
    ARRAY['Kerala','Andhra Pradesh','Puducherry','Lakshadweep'],
    5900, 0, 99900, 4, 6, true, 4900
  ),
  (
    'East India',
    ARRAY['Odisha','Bihar','Jharkhand','Chhattisgarh'],
    6900, 0, 99900, 5, 7, true, 4900
  ),
  (
    'West India',
    ARRAY['Gujarat','Goa','Madhya Pradesh','Dadra and Nagar Haveli','Daman and Diu'],
    5900, 0, 99900, 4, 6, true, 4900
  ),
  (
    'Northeast & Remote',
    ARRAY['Assam','Meghalaya','Manipur','Nagaland','Mizoram','Tripura','Arunachal Pradesh','Sikkim','Andaman and Nicobar Islands'],
    9900, 0, 149900, 7, 10, true, 4900
  )
ON CONFLICT DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- PART 4: SETTINGS (24)
-- ─────────────────────────────────────────────────────────────

INSERT INTO settings (key, value, description) VALUES
  ('site_name',           '"French Toes"',                                       'Brand name'),
  ('site_tagline',        '"Walk Pretty, Live Pretty"',                           'Brand tagline'),
  ('hero_headline',       '"Slip Into Summer"',                                   'Home page hero headline'),
  ('hero_subtext',        '"Handcrafted slippers made for Indian women"',          'Home page hero subtext'),
  ('hero_cta_text',       '"Shop Now"',                                            'Hero CTA button text'),
  ('hero_cta_url',        '"/shop"',                                               'Hero CTA link'),
  ('free_shipping_above', '99900',                                                 'Free shipping threshold in paise (₹999)'),
  ('cod_charge',          '4900',                                                  'COD charge in paise (₹49)'),
  ('gst_percent',         '5',                                                     'Default GST percentage'),
  ('currency',            '"INR"',                                                  'Site currency'),
  ('support_email',       '"hello@frenchtoes.in"',                                 'Customer support email'),
  ('support_phone',       '"9876543210"',                                          'Customer support phone'),
  ('whatsapp_number',     '"9876543210"',                                          'WhatsApp support number'),
  ('instagram_url',       '"https://instagram.com/frenchtoes"',                    'Instagram profile URL'),
  ('facebook_url',        '"https://facebook.com/frenchtoes"',                     'Facebook page URL'),
  ('return_policy_days',  '15',                                                    'Number of days for returns'),
  ('min_order_amount',    '0',                                                     'Minimum order amount in paise'),
  ('max_cod_amount',      '500000',                                                'Max COD order value in paise (₹5000)'),
  ('low_stock_threshold', '10',                                                    'Default low stock alert threshold'),
  ('reviews_per_page',    '10',                                                    'Number of reviews per page'),
  ('products_per_page',   '12',                                                    'Products per page in shop'),
  ('loyalty_points_rate', '1',                                                     'Loyalty points per ₹100 spent'),
  ('meta_title',          '"French Toes — Handcrafted Women''s Slippers"',         'Default SEO meta title'),
  ('meta_description',    '"Premium handcrafted slippers for Indian women. Shop Chicago, Maxico, Milano, Indiano & more. Free shipping above ₹999."', 'Default SEO meta description')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;


-- ─────────────────────────────────────────────────────────────
-- PART 5: COUPONS (2)
-- ─────────────────────────────────────────────────────────────

INSERT INTO coupons (code, description, discount_type, discount_value, max_discount_amount, min_order_value, max_uses, max_uses_per_user, current_uses, valid_from, valid_until, is_active)
VALUES
  (
    'WELCOME10',
    'Welcome discount — 10% off your first order',
    'percentage',
    10,
    50000,   -- max discount ₹500 in paise
    0,       -- no minimum
    NULL,    -- unlimited uses
    1,       -- once per user
    0,
    NOW(),
    NULL,    -- never expires
    true
  ),
  (
    'SUMMER50',
    'Summer sale — flat ₹50 off',
    'fixed',
    5000,    -- ₹50 flat discount
    NULL,
    49900,   -- min order ₹499
    500,     -- 500 total uses
    5,       -- 5 per user
    0,
    NOW(),
    '2025-09-30 23:59:59+05:30',
    true
  )
ON CONFLICT (code) DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- VERIFICATION
-- ─────────────────────────────────────────────────────────────

SELECT '✅ Products'       AS item, count(*) AS count FROM products
UNION ALL
SELECT '✅ Categories',    count(*)         FROM categories
UNION ALL
SELECT '✅ Shipping Zones',count(*)         FROM shipping_zones
UNION ALL
SELECT '✅ Settings',      count(*)         FROM settings
UNION ALL
SELECT '✅ Coupons',       count(*)         FROM coupons;

-- Preview products
SELECT
  name,
  '₹' || (price/100)::text AS price,
  CASE WHEN original_price IS NOT NULL THEN '₹' || (original_price/100)::text ELSE '-' END AS original,
  is_best_seller, is_new_arrival, is_limited_edition,
  rating_avg, sales_count
FROM products
ORDER BY sales_count DESC;
