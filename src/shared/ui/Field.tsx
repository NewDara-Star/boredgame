import type { InputHTMLAttributes, ReactNode } from "react";

export function Field({
  label, error, hint, children,
}: { label: string; error?: string | null; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-chalk">{label}</span>
      {hint && <span className="block text-xs text-faint mt-0.5">{hint}</span>}
      <div className="mt-1.5">{children}</div>
      {error && <span className="block text-xs text-bad mt-1">{error}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full bg-ink border border-line rounded-xl px-3 py-2.5 text-chalk
        placeholder:text-faint focus:border-picto outline-none ${props.className ?? ""}`}
    />
  );
}
