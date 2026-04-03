import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

/**
 * Uploads a file to Firebase Storage and returns the download URL.
 * @param path The path where the file should be stored (e.g., 'profiles/uid/avatar.jpg')
 * @param file The file object to upload
 */
export async function uploadFile(path: string, file: File): Promise<string> {
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file);
  return getDownloadURL(snapshot.ref);
}

/**
 * Uploads a profile picture for a user.
 * @param uid The user's ID
 * @param file The image file
 */
export async function uploadProfilePicture(uid: string, file: File): Promise<string> {
  const extension = file.name.split('.').pop();
  const path = `profiles/${uid}/avatar_${Date.now()}.${extension}`;
  return uploadFile(path, file);
}

/**
 * Uploads a product image.
 * @param productId The product ID
 * @param file The image file
 */
export async function uploadProductImage(productId: string, file: File): Promise<string> {
  const extension = file.name.split('.').pop();
  const randomStr = Math.random().toString(36).substring(7);
  const path = `products/${productId}/${Date.now()}_${randomStr}.${extension}`;
  return uploadFile(path, file);
}
