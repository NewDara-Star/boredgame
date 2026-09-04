import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-panel border border-line rounded-2xl ${className}`}>{children}</div>;
}
