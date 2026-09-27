"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState | undefined, FormData>(
    login,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700 dark:text-gray-300">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-gray-100"
        />
        {state?.fieldErrors?.email ? (
          <span className="text-xs text-red-600">{state.fieldErrors.email[0]}</span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700 dark:text-gray-300">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-gray-100"
        />
        {state?.fieldErrors?.password ? (
          <span className="text-xs text-red-600">
            {state.fieldErrors.password[0]}
          </span>
        ) : null}
      </label>

      {state?.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition disabled:opacity-60 dark:bg-gray-100 dark:text-gray-900"
      >
        {pending ? "Memproses…" : "Masuk"}
      </button>
    </form>
  );
}
