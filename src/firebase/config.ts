const requiredPublicEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(`[firebase] Missing env var: ${name}`);
    }
    return '';
  }
  return value;
};

export const firebaseConfig = {
  // NOTE: Firebase client config values (including apiKey) are not secrets,
  // but should still come from env vars for multi-environment deploys.
  projectId: requiredPublicEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
  appId: requiredPublicEnv('NEXT_PUBLIC_FIREBASE_APP_ID'),
  apiKey: requiredPublicEnv('NEXT_PUBLIC_FIREBASE_API_KEY'),
  authDomain: requiredPublicEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
  messagingSenderId: requiredPublicEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
};
