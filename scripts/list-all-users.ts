import 'dotenv/config';
import { prisma } from '../src/config/db';

async function main() {
  const users = await prisma.user.findMany();
  console.log('Users in database:');
  users.forEach(user => {
    console.log(`ID: ${user.id}, Email: ${user.email}, FirebaseID: ${user.firebaseId}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
