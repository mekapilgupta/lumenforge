// ─── French Toes — Product Catalogue ─────────────────────────────────────────
// RAZORPAY_APPROVAL: Single product hardcoded for payment gateway demo/approval.
// All DB fetching is bypassed; only this static product is shown everywhere.
import type { Product } from '$lib/types';

// Lifestyle / hero images (kept for HeroSlider)
export const LIFESTYLE_IMAGES = {
  hero1: 'https://images.pexels.com/photos/1032110/pexels-photo-1032110.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero2: 'https://images.pexels.com/photos/931177/pexels-photo-931177.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero3: 'https://images.pexels.com/photos/1408221/pexels-photo-1408221.jpeg?auto=compress&cs=tinysrgb&w=1600',
  collection1: 'https://images.pexels.com/photos/1032110/pexels-photo-1032110.jpeg?auto=compress&cs=tinysrgb&w=800',
  collection2: 'https://images.pexels.com/photos/949670/pexels-photo-949670.jpeg?auto=compress&cs=tinysrgb&w=800',
  collection3: 'https://images.pexels.com/photos/1319460/pexels-photo-1319460.jpeg?auto=compress&cs=tinysrgb&w=800',
  collection4: 'https://images.pexels.com/photos/5709661/pexels-photo-5709661.jpeg?auto=compress&cs=tinysrgb&w=800',
};

export const PASTEL_COLORS = {
  blush:    { name: 'Blush',    hex: '#f4a7c3' },
  peach:    { name: 'Peach',    hex: '#ffb347' },
  lavender: { name: 'Lavender', hex: '#c9a0dc' },
  mint:     { name: 'Mint',     hex: '#7ecba1' },
  coral:    { name: 'Coral',    hex: '#ff7f6e' },
  gold:     { name: 'Gold',     hex: '#d4a853' },
  white:    { name: 'White',    hex: '#f5f0eb' },
  nude:     { name: 'Nude',     hex: '#d4a574' },
};

const ALL_SIZES = [35, 36, 37, 38, 39, 40, 41, 42];

export const products: Product[] = [];

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getRelatedProducts(_currentSlug: string, _count = 4): Product[] {
  // RAZORPAY_APPROVAL: Only one product exists, so related = empty
  return [];
}

export function getBestSellers(): Product[] {
  return products.filter((p) => p.badges.includes('Best Seller'));
}

export function getNewArrivals(): Product[] {
  return products.filter((p) => p.badges.includes('New Arrival') || p.isNew);
}

export function getSaleProducts(): Product[] {
  return products.filter((p) => p.originalPrice !== undefined);
}

// Fallback defaults when database values are missing
export const PRODUCT_DEFAULTS = {
  description: "Experience effortless comfort with our premium women's slippers, thoughtfully crafted for everyday wear.",
  highlights: [
    "Premium vegan-eco friendly materials",
    "Ultra-lightweight design",
    "Soft and comfortable footbed",
    "Suitable for all-day wear",
    "Stylish and versatile look",
    "Durable and easy to maintain",
    "Perfect for home, office, shopping, and everyday outings"
  ],
  details: `Description: Experience effortless comfort with our premium women's slippers, thoughtfully crafted for everyday wear. 

Features:
•  Premium vegan-eco friendly materials 
•  Ultra-lightweight design 
•  Soft and comfortable footbed 
•  Suitable for all-day wear 
•  Stylish and versatile look 
•  Durable and easy to maintain 
•  Perfect for home, office, shopping, and everyday outings`,
  materials: `Upper - Synthetic 
Insole - EVA
Outsole - EVA`,
  care: "Clean with damp cloth",
  shipping: `More information:
Manufacturer- Vertex International Pvt. Ltd.,
32nd km stone, Kundli, Sonepat, Haryana

Return and exchange:
Easy return and exchange within 7 days of delivery.
A ₹99 reverse shipping fee is deducted on returns to cover pickup and processing. Exchanges are free`
};