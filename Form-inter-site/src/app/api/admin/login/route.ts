import { NextRequest, NextResponse } from "next/server";
import { verifyAdminCredentials } from "@/lib/auth";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { loginSchema } from "@/lib/validation";

// Le site est prévu pour tourner en HTTP sur le LAN (pas de HTTPS intégré).
// Marquer le cookie `Secure` dès que NODE_ENV vaut "production" — donc dans
// l'image Docker — le rend impossible à poser depuis un navigateur sur
// http://<ip-du-serveur>:3000 : la connexion échoue en boucle, sans message,
// puisque le serveur, lui, a bien répondu « ok ».
//
// Le drapeau n'est donc posé que si la requête est réellement arrivée en
// HTTPS — cas d'un reverse proxy TLS, qui l'annonce par X-Forwarded-Proto —
// ou si COOKIE_SECURE=1 le force explicitement.
function cookieSecurise(request: NextRequest): boolean {
  if (process.env.COOKIE_SECURE === "1") return true;
  const protocole =
    request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol;
  return protocole.startsWith("https");
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Email ou mot de passe invalide" },
      { status: 400 }
    );
  }

  const admin = await verifyAdminCredentials(
    parsed.data.email,
    parsed.data.password
  );

  if (!admin) {
    return NextResponse.json(
      { error: "Identifiants incorrects" },
      { status: 401 }
    );
  }

  const token = await createSessionToken({ email: admin.email });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecurise(request),
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
