import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { normalizeEnvValue } from './env.js';

function getServiceAccount() {
  const raw =
    normalizeEnvValue(process.env.FIREBASE_SERVICE_ACCOUNT) ||
    normalizeEnvValue(process.env.FIREBASE_SERVICE_ACCOUNT_JSON) ||
    normalizeEnvValue(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

  if (!raw) {
    return null;
  }

  const parsed = JSON.parse(raw);
  if (parsed.private_key) {
    parsed.private_key = String(parsed.private_key).replace(/\\n/g, '\n');
  }
  return parsed;
}

export function getAdminDb() {
  if (!getApps().length) {
    const serviceAccount = getServiceAccount();
    if (serviceAccount) {
      initializeApp({ credential: cert(serviceAccount) });
    } else {
      initializeApp();
    }
  }
  return getFirestore();
}
