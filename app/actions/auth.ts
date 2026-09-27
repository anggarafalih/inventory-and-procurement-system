"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/session";
import { loginSchema } from "@/lib/validation";

export interface LoginState {
  error?: string;
  fieldErrors?: Partial<Record<"email" | "password", string[]>>;
}

export async function login(
  _prev: LoginState | undefined,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  // Constant-ish response: always run a hash compare to blunt user enumeration.
  const DUMMY_HASH =
    "$2b$10$sYmRefCtJ5/qLg75NZykN.rY8.XUvHBKDRLwoEWoZE/YijmBs8sxK";
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !ok || !user.isActive) {
    return { error: "Email atau password salah." };
  }

  await createSession({ userId: user.id, role: user.role });

  const next = formData.get("next");
  redirect(typeof next === "string" && next.startsWith("/") ? next : "/dashboard");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
