import 'dotenv/config';
import { prisma } from '../src/config/db';

async function main() {
  // Delete all users from the User table
  await prisma.user.deleteMany({});
  console.log('All users deleted.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
