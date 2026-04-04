export const PRODUCT_CATEGORIES = [
  'Sneakers',
  'Clothing',
  'Accessories',
  'Electronics',
  'Collectibles',
  'Toys & Games',
  'Books & Media',
  'Beauty & Health',
  'Home & Decor',
  'Sports & Outdoors',
  'Art & Crafts',
  'Vintage & Retro',
  'Other',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/**
 * Maps an AI-generated category string to the closest standard category.
 * Falls back to 'Other' if no match found.
 */
export function mapToStandardCategory(aiCategory: string): ProductCategory {
  const lower = aiCategory.toLowerCase();

  if (/sneak|shoe|boot|footwear|trainer/.test(lower)) return 'Sneakers';
  if (/cloth|shirt|jacket|pants|dress|hoodie|apparel|wear|fashion/.test(lower)) return 'Clothing';
  if (/access|bag|wallet|watch|jewel|belt|hat|cap|scarf/.test(lower)) return 'Accessories';
  if (/electron|phone|laptop|tablet|gadget|tech|camera|console|gaming|audio|headphone|speaker/.test(lower)) return 'Electronics';
  if (/collect|figure|pop|funko|card|trading|model|statue|vinyl/.test(lower)) return 'Collectibles';
  if (/toy|game|puzzle|board game|lego|plush/.test(lower)) return 'Toys & Games';
  if (/book|dvd|blu.ray|cd|record|vinyl|media|comic|manga/.test(lower)) return 'Books & Media';
  if (/beauty|health|skincare|makeup|cosmetic|fragrance|perfume|supplement/.test(lower)) return 'Beauty & Health';
  if (/home|decor|furniture|kitchen|lamp|art|plant|candle/.test(lower)) return 'Home & Decor';
  if (/sport|outdoor|gym|fitness|cycling|hiking|camping/.test(lower)) return 'Sports & Outdoors';
  if (/art|craft|paint|draw|handmade|diy/.test(lower)) return 'Art & Crafts';
  if (/vintage|retro|antique|classic|old/.test(lower)) return 'Vintage & Retro';

  return 'Other';
}
