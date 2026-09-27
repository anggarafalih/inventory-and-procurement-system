import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk · Mayora" };

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;

  return (
    <main className="flex min-h-full items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-950">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Inventory &amp; Request
        </h1>
        <p className="mb-6 mt-1 text-sm text-gray-500 dark:text-gray-400">
          Masuk untuk mengajukan permintaan barang &amp; approval.
        </p>
        <LoginForm next={nextPath} />
      </div>
    </main>
  );
}
