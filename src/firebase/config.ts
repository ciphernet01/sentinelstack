export const firebaseConfig = {
  // NOTE: Firebase client config values (including apiKey) are not secrets,
  // but should still come from env vars for multi-environment deploys.
  // IMPORTANT: In Next.js client bundles, only *direct* references like
  // `process.env.NEXT_PUBLIC_...` are inlined at build time.
  // Do not use dynamic access like `process.env[name]` here.
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
};
