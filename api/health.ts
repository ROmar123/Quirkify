export default function handler(req: any, res: any) {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    yocoKeyConfigured: !!process.env.YOCO_SECRET_KEY,
    firebaseConfigured: !!process.env.FIREBASE_SERVICE_ACCOUNT
  });
}
