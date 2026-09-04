import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger";

const styles: Record<Variant, string> = {
  primary: "bg-picto text-ink hover:brightness-110",
  ghost: "bg-panel border border-line text-chalk hover:bg-panel-2",
  danger: "bg-bad text-white hover:brightness-110",
};

export function Button({
  variant = "primary",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...rest}
      className={`rounded-xl px-4 py-3 font-semibold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    />
  );
}
