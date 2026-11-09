import { ApiError } from "@/lib/http";

export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ApiError("ข้อมูล JSON ไม่ถูกต้อง", 400);
    }
    throw error;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("รูปแบบข้อมูลไม่ถูกต้อง", 400);
  }
  return value as Record<string, unknown>;
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) {
    throw new ApiError("คำขอไม่ผ่านการตรวจสอบแหล่งที่มา", 403);
  }

  try {
    if (new URL(origin).origin === new URL(request.url).origin) {
      return;
    }
  } catch (error) {
    if (!(error instanceof TypeError)) {
      throw error;
    }
  }
  throw new ApiError("คำขอไม่ผ่านการตรวจสอบแหล่งที่มา", 403);
}
