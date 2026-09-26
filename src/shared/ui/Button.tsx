import type { ButtonHTMLAttributes } from "react";

/** One colour, one job (BRAND.md): gold is the main action, green joins and confirms,
    sky is the second choice, ember leaves. Ghost is the quiet white one. */
type Variant = "primary" | "join" | "secondary" | "leave" | "ghost";

const styles: Record<Variant, string> = {
  primary: "cut-petal",
  join: "cut-leaf",
  secondary: "cut-sky",
  leave: "cut-ember",
  ghost: "cut-board",
};

export function Button({
  variant = "primary", className = "", ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...rest}
      // The drawings' .cut: 52px tall, the display face at 19px.
      className={`cut tap font-display text-[19px] min-h-[52px] px-4
        disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    />
  );
}
