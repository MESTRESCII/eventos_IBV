import { COOKIE_NAME } from "@/libs/session";

export async function POST() {
  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict`,
      },
    },
  );
}
