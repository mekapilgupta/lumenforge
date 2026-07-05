-- ============================================================
-- Category Migration Script — Wedges, Flats, Daily Comfort
-- Run this in your Supabase SQL Editor.
-- ============================================================

-- 1. Insert the new categories (or update them if they exist)
INSERT INTO categories (name, slug, description, display_order, is_active)
VALUES
  ('WEDGES', 'wedges', 'Premium handcrafted wedges', 1, true),
  ('FLATS', 'flats', 'Elegant and breathable flats', 2, true),
  ('DAILY COMFORT', 'daily-comfort', 'Ultra-cushioned daily comfort slides', 3, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

-- 2. Map existing products to the new category IDs based on their model/series names and tags
UPDATE products
SET category_id = (SELECT id FROM categories WHERE slug = 'wedges')
WHERE name ILIKE '%california%' OR tags @> ARRAY['model-california']
   OR name ILIKE '%new jersey%' OR tags @> ARRAY['model-new-jersey']
   OR name ILIKE '%virginia%' OR tags @> ARRAY['model-virginia'];

UPDATE products
SET category_id = (SELECT id FROM categories WHERE slug = 'flats')
WHERE name ILIKE '%chicago%' OR tags @> ARRAY['model-chicago']
   OR name ILIKE '%mexico%' OR tags @> ARRAY['model-mexico']
   OR name ILIKE '%maxico%' OR tags @> ARRAY['model-maxico']
   OR name ILIKE '%milano%' OR tags @> ARRAY['model-milano']
   OR name ILIKE '%phoenix%' OR tags @> ARRAY['model-phoenix']
   OR name ILIKE '%sydney%' OR tags @> ARRAY['model-sydney']
   OR name ILIKE '%venice%' OR tags @> ARRAY['model-venice'];

UPDATE products
SET category_id = (SELECT id FROM categories WHERE slug = 'daily-comfort')
WHERE name ILIKE '%miami%' OR tags @> ARRAY['model-miami-1'] OR tags @> ARRAY['model-miami-2'] OR tags @> ARRAY['model-miami-3']
   OR name ILIKE '%bermuda%' OR tags @> ARRAY['model-bermuda'];

-- 3. Safely delete the old categories that are no longer in use
DELETE FROM categories
WHERE slug NOT IN ('wedges', 'flats', 'daily-comfort');
