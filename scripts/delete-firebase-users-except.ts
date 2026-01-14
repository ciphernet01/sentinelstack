import 'dotenv/config';

import * as admin from 'firebase-admin';
import { getApps, initializeApp } from 'firebase-admin/app';
import { readFileSync } from 'fs';

function loadServiceAccount(): admin.ServiceAccount {
  const jsonFromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (jsonFromEnv) {
    return JSON.parse(jsonFromEnv) as admin.ServiceAccount;
  }

  const pathFromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (pathFromEnv) {
    return JSON.parse(readFileSync(pathFromEnv, 'utf8')) as admin.ServiceAccount;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && privateKey) {
    return {
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    } as admin.ServiceAccount;
  }

  throw new Error(
    'Missing Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON, or set FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.'
  );
}

// Initialize Firebase Admin
if (!getApps().length) {
  const serviceAccount = loadServiceAccount();

  initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

const DEFAULT_EMAIL = 'shrey@gmail.com';

async function deleteAllUsersExcept(keepEmail: string, nextPageToken?: string) {
  const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);
  
  const usersToDelete = listUsersResult.users
    .filter(user => user.email !== keepEmail)
    .map(user => user.uid);
  
  if (usersToDelete.length > 0) {
    await admin.auth().deleteUsers(usersToDelete);
    console.log(`Deleted ${usersToDelete.length} users from Firebase Auth.`);
    
    // List deleted emails
    listUsersResult.users
      .filter(user => user.email !== keepEmail)
      .forEach(user => {
        console.log(`  - Deleted: ${user.email}`);
      });
  }
  
  // Show kept user
  listUsersResult.users
    .filter(user => user.email === keepEmail)
    .forEach(user => {
      console.log(`✅ Kept: ${user.email}`);
    });
  
  if (listUsersResult.pageToken) {
    await deleteAllUsersExcept(keepEmail, listUsersResult.pageToken);
  }
}

deleteAllUsersExcept(DEFAULT_EMAIL)
  .then(() => {
    console.log(`\n✅ Cleanup complete! Only ${DEFAULT_EMAIL} remains in Firebase Auth.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error deleting Firebase Auth users:', err);
    process.exit(1);
  });
