import type { ReactNode } from "react";

export const inputCls =
  "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-gray-100";

export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <p
      className={`rounded-md px-3 py-2 text-sm ${
        error
          ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
          : "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      }`}
    >
      {error ?? ok}
    </p>
  );
}

export function Labeled({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-gray-600 dark:text-gray-400">
        {label}
      </span>
      {children}
    </label>
  );
}

export function Disclosure({
  summary,
  children,
}: {
  summary: string;
  children: ReactNode;
}) {
  return (
    <details className="rounded-lg border border-gray-200 dark:border-gray-800">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        {summary}
      </summary>
      <div className="border-t border-gray-100 p-3 dark:border-gray-800">
        {children}
      </div>
    </details>
  );
}

/// Reads `ok` / `error` from an awaited searchParams object.
export function flashFrom(sp: {
  [k: string]: string | string[] | undefined;
}): { ok?: string; error?: string } {
  return {
    ok: typeof sp.ok === "string" ? sp.ok : undefined,
    error: typeof sp.error === "string" ? sp.error : undefined,
  };
}
