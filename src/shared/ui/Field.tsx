import type { InputHTMLAttributes, ReactNode } from "react";

/**
 * A form field, from the drawings' code (#50, #51): the label small and bold
 * over the box (.lbl), the box itself (.field), and one line under it: why it
 * won't do (ember), that it will ("Dara is free", leaf), or a plain hint.
 */
export function Field({
  label, error, hint, good, children,
}: { label: string; error?: string | null; hint?: string;
     /** the hint is good news ("Dara is free."), so it's green */
     good?: boolean; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[12px] font-extrabold text-soft">{label}</span>
      {children}
      {error ? (
        <span className="text-[13px] font-bold text-ember-lo" role="alert">{error}</span>
      ) : hint ? (
        <span className={`text-[13px] font-bold ${good ? "text-leaf-deep" : "text-soft"}`}>{hint}</span>
      ) : null}
    </label>
  );
}

/** .field: white, 14px round, a 2px hair ring that turns sky while you type. */
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full bg-board rounded-[14px] px-3.5 py-3 text-[16px] font-semibold
        text-ink placeholder:text-soft outline-none focus-visible:outline-none
        shadow-[inset_0_0_0_2px_var(--color-hair)] focus:shadow-[inset_0_0_0_2.5px_var(--color-sky)]
        transition-shadow ${props.className ?? ""}`}
    />
  );
}
