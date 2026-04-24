import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { ReviewEntry } from '../types';

export async function submitReviewEntry(entry: Omit<ReviewEntry, 'id'>) {
  const ref = doc(collection(db, 'reviewQueue'));
  const payload: ReviewEntry = { id: ref.id, ...entry };
  await setDoc(ref, payload);
  return payload;
}
