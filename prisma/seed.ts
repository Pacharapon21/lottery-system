import "dotenv/config";
import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/password";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set before seeding.");
  }
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must contain at least 12 characters.");
  }

  await prisma.admin.upsert({
    where: { email },
    create: { email, passwordHash: hashPassword(password) },
    update: { passwordHash: hashPassword(password) },
  });

  console.info(`Admin account provisioned for ${email}.`);
}

main()
  .catch((error: unknown) => {
    console.error("Failed to provision the admin account:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
