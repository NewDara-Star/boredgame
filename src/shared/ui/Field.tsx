import type { InputHTMLAttributes, ReactNode } from "react";

export function Field({
  label, error, hint, children,
}: { label: string; error?: string | null; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="font-display text-[15px] font-semibold">{label}</span>
      {hint && <span className="block text-xs text-soft mt-0.5 font-medium">{hint}</span>}
      <div className="mt-2">{children}</div>
      {error && (
        <span className="mt-1.5 inline-block text-xs font-bold text-surface bg-bad rounded-lg px-2 py-1">
          {error}
        </span>
      )}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full bg-surface border-[2.5px] border-ink rounded-2xl px-4 py-3 font-semibold
        text-ink placeholder:text-soft/60 outline-none focus:shadow-[0_4px_0_var(--color-ink)]
        transition-shadow ${props.className ?? ""}`}
    />
  );
}
