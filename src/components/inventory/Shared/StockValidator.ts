import { Product, AllocationSnapshot } from '../../../types';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ProductValidation {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validate product data for inventory hub
 * Checks all required fields and business logic constraints
 */
export const validateProduct = (product: Partial<Product>): ProductValidation => {
  const errors: ValidationError[] = [];

  // Required fields
  if (!product.name?.trim()) {
    errors.push({ field: 'name', message: 'Product name is required' });
  }

  if (!product.description?.trim()) {
    errors.push({ field: 'description', message: 'Description is required' });
  }

  if (!product.category?.trim()) {
    errors.push({ field: 'category', message: 'Category is required' });
  }

  // Pricing validation
  if (!product.retailPrice || product.retailPrice <= 0) {
    errors.push({ field: 'retailPrice', message: 'Retail price is required and must be greater than 0' });
  }

  if (product.markdownPercentage === undefined || product.markdownPercentage < 0 || product.markdownPercentage > 100) {
    errors.push({ field: 'markdownPercentage', message: 'Markdown must be between 0 and 100%' });
  }

  // Stock validation
  if (!product.stock || product.stock <= 0) {
    errors.push({ field: 'stock', message: 'Stock must be at least 1 unit' });
  }

  // Condition validation
  if (!product.condition) {
    errors.push({ field: 'condition', message: 'Condition is required' });
  }

  // Image validation
  if (!product.imageUrl) {
    errors.push({ field: 'imageUrl', message: 'Product image is required' });
  }

  // Allocation validation
  if (product.stock && product.allocations) {
    const totalAllocated = product.allocations.store + product.allocations.auction + product.allocations.packs;
    if (totalAllocated > product.stock) {
      errors.push({
        field: 'allocations',
        message: `Total allocated (${totalAllocated}) cannot exceed total stock (${product.stock})`
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate only allocation constraints
 */
export const validateAllocations = (
  allocations: AllocationSnapshot,
  totalStock: number
): ValidationError[] => {
  const errors: ValidationError[] = [];
  const total = allocations.store + allocations.auction + allocations.packs;

  if (total > totalStock) {
    errors.push({
      field: 'allocations',
      message: `Total allocated (${total}) cannot exceed total stock (${totalStock})`
    });
  }

  return errors;
};

/**
 * Check if product can be listed in a specific channel
 */
export const canListInChannel = (
  product: Product,
  channel: 'store' | 'auction' | 'packs'
): { allowed: boolean; reason?: string } => {
  if (!product.allocations) {
    return { allowed: false, reason: 'Product has no allocations configured' };
  }

  const allocation = product.allocations[channel];
  if (allocation <= 0) {
    return { allowed: false, reason: `No inventory allocated for ${channel}` };
  }

  return { allowed: true };
};

/**
 * Calculate optimal default allocations
 * Default: 100% to store channel
 */
export const getDefaultAllocations = (totalStock: number): AllocationSnapshot => {
  return {
    store: totalStock,
    auction: 0,
    packs: 0
  };
};

/**
 * Calculate selling price from retail and markdown
 */
export const calculateSellingPrice = (retailPrice: number, markdownPercentage: number): number => {
  return Math.round(retailPrice * (1 - markdownPercentage / 100));
};
