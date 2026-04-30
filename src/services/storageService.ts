import { supabase } from '../supabase';

/**
 * Uploads a file to Supabase Storage (product-images bucket) and returns the public URL.
 */
export async function uploadFile(path: string, file: File): Promise<string> {
  const { data, error } = await supabase.storage
    .from('product-images')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error(error.message);
  const { data: urlData } = supabase.storage
    .from('product-images')
    .getPublicUrl(data.path);
  return urlData.publicUrl;
}

/**
 * Uploads a profile picture for a user.
 */
export async function uploadProfilePicture(uid: string, file: File): Promise<string> {
  const extension = file.name.split('.').pop();
  const path = `profiles/${uid}/avatar_${Date.now()}.${extension}`;
  return uploadFile(path, file);
}

/**
 * Uploads a product image.
 */
export async function uploadProductImage(productId: string, file: File): Promise<string> {
  const extension = file.name.split('.').pop();
  const randomStr = Math.random().toString(36).substring(7);
  const path = `products/${productId}/${Date.now()}_${randomStr}.${extension}`;
  return uploadFile(path, file);
}
