export const PRODUCT_CATEGORIES = [
  'Sneakers',
  'Clothing',
  'Accessories',
  'Electronics',
  'Collectibles',
  'Other',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/**
 * Maps an AI-generated category string to the closest DB-valid category.
 * DB CHECK constraint only allows: Sneakers, Clothing, Accessories, Electronics, Collectibles, Other.
 */
export function mapToStandardCategory(aiCategory: string): ProductCategory {
  const lower = aiCategory.toLowerCase();

  if (/sneak|shoe|boot|footwear|trainer/.test(lower)) return 'Sneakers';
  if (/cloth|shirt|jacket|pants|dress|hoodie|apparel|wear|fashion/.test(lower)) return 'Clothing';
  if (/access|bag|wallet|watch|jewel|belt|hat|cap|scarf|beauty|health|skincare|makeup|cosmetic|fragrance|perfume/.test(lower)) return 'Accessories';
  if (/electron|phone|laptop|tablet|gadget|tech|camera|console|gaming|audio|headphone|speaker/.test(lower)) return 'Electronics';
  if (/collect|figure|pop|funko|card|trading|model|statue|vinyl|toy|game|puzzle|lego|plush|art|craft|vintage|retro|antique/.test(lower)) return 'Collectibles';

  return 'Other';
}
