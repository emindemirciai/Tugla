import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

export interface CreateClientOptions {
  connectionString?: string;
  max?: number;
}

export const createPrismaClient = (options: CreateClientOptions = {}) => {
  const connectionString =
    options.connectionString ??
    process.env.DATABASE_URL ??
    'postgresql://pulse:pulse@localhost:5432/pulse?schema=public';
  const adapter = new PrismaPg({ connectionString, max: options.max ?? 10 });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
};

const globalDatabase = globalThis as unknown as { prisma?: PrismaClient };

export const database = globalDatabase.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalDatabase.prisma = database;

export * from '@prisma/client';
