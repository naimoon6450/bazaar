import { NextRequest } from "next/server";
import {
  validateAdminPassword,
  getSessionToken,
  SESSION_COOKIE,
} from "@/lib/validation/admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password || !validateAdminPassword(password)) {
      return Response.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }

    const token = getSessionToken();

    const response = Response.json({ success: true });
    response.headers.set(
      "Set-Cookie",
      `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 24 * 7}`
    );

    return response;
  } catch (err) {
    console.error("POST /api/admin/login error:", err);
    return Response.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
