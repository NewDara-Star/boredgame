import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const styles: Record<Variant, string> = {
  primary: "bg-picto text-surface",
  secondary: "bg-trivia text-surface",
  ghost: "bg-surface text-ink",
};

export function Button({
  variant = "primary", className = "", ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...rest}
      className={`piece press font-display text-[15px] font-semibold px-5 py-3.5 rounded-2xl
        disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    />
  );
}
