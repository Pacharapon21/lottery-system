import { PrismaClient } from "@prisma/client";
import { ApiError } from "./http";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

function getPrismaClient(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new ApiError(
      "ยังไม่ได้ตั้งค่า DATABASE_URL ในไฟล์ .env กรุณาระบุ Neon PostgreSQL Connection String",
      500,
    );
  }
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
