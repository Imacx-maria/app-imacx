import { cookies } from "next/headers";
import crypto from "crypto";
import type { PermissionId, RoleId } from "@/types/permissions";

const COOKIE_NAME = "imx-perms";
const DEFAULT_MAX_AGE_SECONDS = 600; // 10 minutes

type PermissionPayload = {
  roles: RoleId[];
  pagePermissions: PermissionId[];
  actionPermissions: PermissionId[];
  userId?: string | null;
  exp: number;
  ver: number;
};

const base64UrlEncode = (data: string) =>
  Buffer.from(data)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const base64UrlDecode = (data: string) =>
  Buffer.from(
    data.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (data.length % 4)) % 4),
    "base64",
  ).toString("utf-8");

function getSecret(): string {
  const secret =
    process.env.PERMISSIONS_COOKIE_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      "Missing PERMISSIONS_COOKIE_SECRET (or NEXTAUTH_SECRET as fallback)",
    );
  }
  return secret;
}

function signPayload(payload: PermissionPayload): string {
  const secret = getSecret();
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${body}.${sig}`;
}

function verifySignature(token: string): PermissionPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const secret = getSecret();
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  try {
    const parsed = JSON.parse(base64UrlDecode(body)) as PermissionPayload;
    if (typeof parsed.exp !== "number" || Date.now() / 1000 > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setPermissionsCookie(
  data: Omit<PermissionPayload, "exp" | "ver">,
  maxAgeSeconds: number = DEFAULT_MAX_AGE_SECONDS,
) {
  const exp = Math.floor(Date.now() / 1000) + maxAgeSeconds;
  const payload: PermissionPayload = { ...data, exp, ver: 1 };
  const token = signPayload(payload);
  cookies().set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export function readPermissionsCookie():
  | {
      roles: RoleId[];
      pagePermissions: PermissionId[];
      actionPermissions: PermissionId[];
      userId?: string | null;
    }
  | null {
  const cookie = cookies().get(COOKIE_NAME);
  if (!cookie?.value) return null;
  const payload = verifySignature(cookie.value);
  if (!payload) return null;
  return {
    roles: payload.roles,
    pagePermissions: payload.pagePermissions,
    actionPermissions: payload.actionPermissions,
    userId: payload.userId,
  };
}

export function clearPermissionsCookie() {
  cookies().set({
    name: COOKIE_NAME,
    value: "",
    maxAge: 0,
    path: "/",
  });
}
