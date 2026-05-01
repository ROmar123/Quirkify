// All product operations go through productService — one mapper, one source of truth.
export { subscribeToProducts as subscribeToProductsAdmin, fetchProducts as fetchAllProductsAdmin } from './productService';
