import { Note } from "@/shared/ui/Note";

/** The questions didn't load: say so, say it's retrying, and offer it now. */
export function BankTrouble({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  if (!message) return null;
  return (
    <div className="space-y-2">
      <Note tone="warn">{message}</Note>
      <button onClick={onRetry}
        className="cut tap w-full py-3 font-display text-lg font-semibold cut-board">
        Try now
      </button>
    </div>
  );
}
