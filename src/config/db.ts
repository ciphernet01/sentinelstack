import { PrismaClient } from '@prisma/client';

// Add `prisma` to the NodeJS `global` object
declare global {
  var prisma: PrismaClient | undefined;
}

// Prevent multiple instances of Prisma Client in development
export const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}
