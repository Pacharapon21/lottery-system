import type { Prisma } from "@prisma/client";

export async function lockDrawSession(
  transaction: Prisma.TransactionClient,
  drawSessionId: string,
): Promise<void> {
  await transaction.$queryRaw`
    SELECT pg_advisory_xact_lock(hashtext(${drawSessionId}))
  `;
}
