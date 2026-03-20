import * as admin from 'firebase-admin';
import fs from 'fs';

export const initializeFirebaseAdmin = () => {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (admin.apps.length > 0) {
    return;
  }

  // 1) Preferred for production on GCP (Cloud Run/GKE/etc.): use Application Default Credentials.
  // This avoids long-lived private keys entirely.
  const hasExplicitEnvCert =
    Boolean(process.env.FIREBASE_PROJECT_ID) &&
    Boolean(process.env.FIREBASE_CLIENT_EMAIL) &&
    Boolean(privateKey);

  if (!serviceAccountPath && !hasExplicitEnvCert) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    console.log('Firebase Admin SDK Initialized (application default credentials)');
    return;
  }

  // 2) If a service account JSON path is provided, use it.
  if (serviceAccountPath) {
    const json = fs.readFileSync(serviceAccountPath, 'utf8');
    const parsed = JSON.parse(json);
    admin.initializeApp({
      credential: admin.credential.cert(parsed),
    });
    console.log('Firebase Admin SDK Initialized (service account path)');
    return;
  }

  // 3) Fallback: split env vars.
  if (!process.env.FIREBASE_PROJECT_ID) {
    throw new Error('FIREBASE_PROJECT_ID not found in environment variables');
  }
  if (!process.env.FIREBASE_CLIENT_EMAIL) {
    throw new Error('FIREBASE_CLIENT_EMAIL not found in environment variables');
  }
  if (!privateKey) {
    throw new Error('FIREBASE_PRIVATE_KEY not found in environment variables');
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
  });

  console.log('Firebase Admin SDK Initialized (env vars)');
};
