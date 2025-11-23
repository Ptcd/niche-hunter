import { PrismaClient } from '@prisma/client';

// Configure Prisma to work with connection poolers (like Supabase)
// This disables prepared statements which aren't supported by poolers
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Disable prepared statements for connection pooler compatibility
  // This prevents "prepared statement does not exist" errors
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

export * from '@prisma/client';
export * from './import-payouts';