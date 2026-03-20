import 'dotenv/config';
import * as admin from 'firebase-admin';
import { getApps, initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import fs from 'fs';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = privateKeyRaw ? privateKeyRaw.replace(/\\n/g, '\n') : undefined;

  if (projectId && clientEmail && privateKey && !clientEmail.includes('CHANGE_ME')) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const json = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
    initializeApp({
      credential: cert(json),
    });
  } else {
    initializeApp({
      credential: applicationDefault(),
    });
  }
}

async function deleteAllUsers(nextPageToken?: string) {
  const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);
  const uids = listUsersResult.users.map(userRecord => userRecord.uid);
  if (uids.length > 0) {
    await admin.auth().deleteUsers(uids);
    console.log(`Deleted ${uids.length} users from Firebase Auth.`);
  }
  if (listUsersResult.pageToken) {
    await deleteAllUsers(listUsersResult.pageToken);
  }
}

deleteAllUsers()
  .then(() => {
    console.log('All Firebase Auth users deleted.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error deleting Firebase Auth users:', err);
    process.exit(1);
  });
