import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@/app/providers/AuthProvider";
import { PictoRenderer } from "@/features/picto/PictoRenderer";
import { Field, Input } from "@/shared/ui/Field";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { validate, isValid, type DraftPuzzle } from "./validation";
import { forgetContent } from "@/features/play/content";
import { clashesWith } from "@/shared/lib/normalise";
import { sayError } from "@/shared/lib/sayError";

/** A category as the database has it. The editor used to carry its own list of
    12 names, missing English and General, and saved none of them (A1, A3). */
interface Category { id: number; name: string }

/** Every Picto answer already in the bank, whatever its status, in pages (the
    server stops at 1,000 rows without saying so). */
async function pictoBank(): Promise<{ id: number; answer: string; accept: string[] | null }[] | null> {
  const PAGE = 1000;
  const out: { id: number; answer: string; accept: string[] | null }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase!.from("puzzles").select("id, answer, accept")
      .eq("game", "picto").order("id").range(from, from + PAGE - 1);
    if (error || !data) return null;
    out.push(...(data as { id: number; answer: string; accept: string[] | null }[]));
    if (data.length < PAGE) return out;
  }
}

const EMPTY: DraftPuzzle = {
  game: "picto", render: "text",
  items: [{ text: "", x: 50, y: 50, size: 15 }],
  imageUrl: "", prompt: "", choices: ["", "", "", ""],
  answer: "", altHint: "", charHint: "", difficulty: "easy", category: "",
};

export function AdminPage() {
  const { user, offline } = useAuth();
  const [d, setD] = useState<DraftPuzzle>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const [cats, setCats] = useState<Category[] | null>(null);
  const [catsFailed, setCatsFailed] = useState(false);
  const loadCats = () => {
    if (!supabase) return;
    setCatsFailed(false);
    void supabase.from("categories").select("id, name").order("id").then(({ data, error }) => {
      if (error || !data) setCatsFailed(true);
      else setCats(data as Category[]);
    });
  };
  useEffect(loadCats, []);
  // Admin is checked server-side (the puzzles RLS is is_admin()), but the page
  // itself was shown to anyone who typed /admin — a non-admin got the whole
  // editor and a raw "row-level security" error on Publish. Ask the database
  // once: null while asking, false redirects, true renders the tool. The gate
  // is a courtesy; the RLS is the guarantee.
  const [allowed, setAllowed] = useState<boolean | null>(null);
  // How long the daily reserve lasts (talk item 19): 10 questions a day.
  const [reserve, setReserve] = useState<{ easy: number; medium: number; hard: number; days: number } | null>(null);
  const loadReserve = async () => {
    if (!supabase) return;
    const { data } = await supabase.rpc("daily_reserve_left");
    if (data) setReserve(data as { easy: number; medium: number; hard: number; days: number });
  };
  useEffect(() => { if (allowed) void loadReserve(); }, [allowed]);
  useEffect(() => {
    if (!supabase) { setAllowed(true); return; }  // offline design mode, no DB to gate on
    if (!user) { setAllowed(false); return; }
    let live = true;
    void supabase.rpc("is_admin").then(({ data }) => { if (live) setAllowed(data === true); });
    return () => { live = false; };
  }, [user]);

  const errors = useMemo(() => validate(d), [d]);
  const ok = isValid(errors);
  const set = <K extends keyof DraftPuzzle>(k: K, v: DraftPuzzle[K]) => setD((p) => ({ ...p, [k]: v }));

  async function save() {
    setTouched(true);
    if (!ok) return;
    if (!supabase || !user) { setMsg({ text: "Sign in to publish.", bad: true }); return; }
    setSaving(true);
    setMsg(null);
    // A Picto answer within the typo allowance of one already in the bank would
    // let a slip on one count as the other. Check the live bank, not just the
    // bundled set the seed checks (A4). If the bank can't be read, don't guess.
    if (d.game === "picto") {
      const bank = await pictoBank();
      if (!bank) {
        setSaving(false);
        setMsg({ text: "Couldn't check the answer against the puzzles already live. Try again.", bad: true });
        return;
      }
      const hit = clashesWith(d.answer, null, bank);
      if (hit.length) {
        setSaving(false);
        setMsg({ text: `"${d.answer.trim()}" is too close to "${hit[0].answer}", already a puzzle: a typo of one would count as the other. Change the answer.`, bad: true });
        return;
      }
    }
    const { error } = await supabase.from("puzzles").insert({
      game: d.game,
      render: d.render,
      spec: d.game === "picto" && d.render === "text" ? { items: d.items.filter((i) => i.text.trim()) } : null,
      image_url: d.render === "image" ? d.imageUrl : null,
      prompt: d.game === "trivia" ? d.prompt : null,
      choices: d.game === "trivia" ? d.choices : null,
      answer: d.answer,
      alt_hint: d.altHint,
      char_hint: d.charHint,
      difficulty: d.difficulty,
      category_id: Number(d.category),
      status: "live",
      // New trivia is the daily's first (talk item 19): nobody downloads it
      // until it has been a daily question, then it joins solo and rooms.
      daily_reserve: d.game === "trivia",
      created_by: user.id,
    });
    setSaving(false);
    if (error) console.error("[BoredGame] publish failed", error);
    setMsg(error ? { text: sayError(error, "Couldn't publish. Try again."), bad: true }
      : { text: d.game === "trivia" ? "Added to the daily reserve. It joins solo and rooms after its daily." : "Published.", bad: false });
    if (!error) { forgetContent(d.game); setD(EMPTY); setTouched(false); void loadReserve(); }
  }

  if (allowed === false) return <Navigate to="/" replace />;
  if (allowed === null) return <p className="text-sm text-soft">One moment…</p>;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Add a puzzle</h1>
      {reserve && (
        <p className={`text-[13px] font-semibold ${reserve.days < 7 ? "text-ember" : "text-soft"}`}>
          Daily reserve: {reserve.days} day{reserve.days === 1 ? "" : "s"} left
          ({reserve.easy} easy, {reserve.medium} medium, {reserve.hard} hard; a day takes 4, 4 and 2).
          {reserve.days < 7 && " Add trivia soon, or the daily starts drawing from questions anyone may have saved."}
        </p>
      )}
      {offline && <p className="text-xs text-ember">No database connected — you can design and preview here, but not publish.</p>}

      <div className="flex gap-2">
        {(["picto", "trivia"] as const).map((g) => (
          <button key={g} onClick={() => set("game", g)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold ${d.game === g ? "bg-mist shadow-lift-sm" : "shadow-lift-sm text-soft"}`}>
            {g === "picto" ? "Picto Phrase" : "Star Trivia"}
          </button>
        ))}
      </div>

      {d.game === "picto" && (
        <>
          <div className="flex gap-2">
            {(["text", "image"] as const).map((rd) => (
              <button key={rd} onClick={() => set("render", rd)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${d.render === rd ? "bg-mist shadow-lift-sm" : "shadow-lift-sm text-soft"}`}>
                {rd === "text" ? "Drawn from text" : "Uploaded image"}
              </button>
            ))}
          </div>

          {d.render === "text" ? (
            <>
              <Card className="aspect-square max-h-72 mx-auto w-full grid place-items-center p-6 text-ink">
                <PictoRenderer spec={{ items: d.items.filter((i) => i.text.trim()) }} />
              </Card>
              <p className="text-[12px] text-soft">Canvas is 100 × 100</p>
              {d.items.map((it, i) => (
                <div key={i} className="grid grid-cols-[1fr_56px_56px_56px_56px_auto] gap-1.5 items-center">
                  <Input value={it.text} placeholder="text"
                    onChange={(e) => set("items", d.items.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} />
                  {(["x", "y", "size", "rotate"] as const).map((f) => (
                    <Input key={f} type="number" placeholder={f} value={it[f] ?? ""}
                      onChange={(e) => set("items", d.items.map((x, j) => j === i ? { ...x, [f]: Number(e.target.value) } : x))} />
                  ))}
                  <button onClick={() => set("items", d.items.filter((_, j) => j !== i))}
                    className="text-ember px-2" aria-label="Remove">×</button>
                </div>
              ))}
              <Button variant="ghost" onClick={() => set("items", [...d.items, { text: "", x: 50, y: 50, size: 15 }])}>
                + Add text
              </Button>
              {touched && errors.items && <p className="text-xs text-ember">{errors.items}</p>}
            </>
          ) : (
            <Field label="Image URL" error={touched ? errors.imageUrl : null}>
              <Input value={d.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://…" />
            </Field>
          )}
        </>
      )}

      {d.game === "trivia" && (
        <>
          <Field label="Question" error={touched ? errors.prompt : null}>
            <Input value={d.prompt} onChange={(e) => set("prompt", e.target.value)} placeholder="Ask it in full" />
          </Field>
          <Field label="Four options" hint="Tap an option's radio to mark it correct" error={touched ? errors.choices : null}>
            <div className="space-y-2">
              {d.choices.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="radio" name="answer" checked={!!c && d.answer === c}
                    onChange={() => set("answer", c)} className="accent-[var(--color-ember)]" />
                  <Input value={c} placeholder={`Option ${i + 1}`}
                    onChange={(e) => set("choices", d.choices.map((x, j) => j === i ? e.target.value : x))} />
                </div>
              ))}
            </div>
          </Field>
        </>
      )}

      {d.game === "picto" && (
        <Field label="Answer" error={touched ? errors.answer : null}>
          <Input value={d.answer} onChange={(e) => set("answer", e.target.value)} placeholder="The phrase" />
        </Field>
      )}
      {d.game === "trivia" && touched && errors.answer && <p className="text-xs text-ember">{errors.answer}</p>}

      <Field label="Description hint" error={touched ? errors.altHint : null}>
        <Input value={d.altHint} onChange={(e) => set("altHint", e.target.value)} placeholder="What the player should notice" />
      </Field>
      <Field label="Character hint" error={touched ? errors.charHint : null}>
        <Input value={d.charHint} onChange={(e) => set("charHint", e.target.value)} placeholder="e.g. 2 words · 5th letter: m" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Difficulty">
          <select value={d.difficulty} onChange={(e) => set("difficulty", e.target.value as DraftPuzzle["difficulty"])}
            className="w-full bg-board shadow-lift-sm rounded-2xl px-3 py-2.5 text-ink">
            <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
          </select>
        </Field>
        <Field label="Category" error={touched ? errors.category : null}>
          <select value={d.category} onChange={(e) => set("category", e.target.value)}
            className="w-full bg-board shadow-lift-sm rounded-2xl px-3 py-2.5 text-ink">
            <option value="">{cats ? "Select…" : catsFailed ? "Couldn't load" : "Loading…"}</option>
            {cats?.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </select>
          {catsFailed && (
            <button onClick={loadCats} className="mt-1 text-[12px] font-bold text-ember underline">Try again</button>
          )}
        </Field>
      </div>

      {touched && !ok && (
        <p className="text-xs text-ember">
          {Object.keys(errors).length} field{Object.keys(errors).length > 1 ? "s" : ""} need attention before this can be published.
        </p>
      )}
      {msg && <p role="status" className={`text-xs ${msg.bad ? "text-ember" : "text-leaf"}`}>{msg.text}</p>}

      <Button onClick={() => void save()} disabled={saving} className="w-full">
        {saving ? "Publishing…" : "Publish puzzle"}
      </Button>
    </div>
  );
}
