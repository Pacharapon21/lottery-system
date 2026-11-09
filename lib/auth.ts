import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Admin } from "@prisma/client";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "lucky_draw_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 8;
const DUMMY_PASSWORD_HASH =
  "scrypt$00000000000000000000000000000000$" + "0".repeat(128);

function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || new TextEncoder().encode(secret).length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 bytes.");
  }
  return new TextEncoder().encode(secret);
}

export async function verifyAdminCredentials(
  email: string,
  password: string,
): Promise<Pick<Admin, "id" | "email"> | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const admin = await prisma.admin.findUnique({ where: { email: normalizedEmail } });
  const validPassword = verifyPassword(
    password,
    admin?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );

  if (!admin || (admin.lockedUntil && admin.lockedUntil > new Date())) {
    return null;
  }
  if (!validPassword) {
    const updated = await prisma.admin.update({
      where: { id: admin.id },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });
    if (updated.failedLoginAttempts >= 5) {
      await prisma.admin.update({
        where: { id: admin.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
        },
      });
    }
    return null;
  }

  await prisma.admin.update({
    where: { id: admin.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
  return { id: admin.id, email: admin.email };
}

export async function createAdminSession(adminId: string): Promise<void> {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(adminId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSessionSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentAdmin(): Promise<
  Pick<Admin, "id" | "email"> | null
> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  const secret = getSessionSecret();
  let adminId: string;
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    if (!payload.sub) {
      return null;
    }
    adminId = payload.sub;
  } catch {
    return null;
  }

  return prisma.admin.findUnique({
    where: { id: adminId },
    select: { id: true, email: true },
  });
}
