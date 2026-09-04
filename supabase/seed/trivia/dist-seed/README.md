# Trivia bank — 1,517 verified questions

## What is here
`bank/*.json` — one file per category, 1,517 questions total. Each carries
`prompt`, four `choices`, the `answer`, a `difficulty` and a one-line
`explanation` shown on the reveal.

## How they were checked
1. **Mechanical gate** — four distinct options, the answer present verbatim,
   length caps that fit a phone, no duplicate prompts, no wording that goes
   stale ("currently", "reigning"), and an explanation that adds a fact rather
   than restating the question. 1,530 written, 1,524 passed.
2. **Blind verification** — every question was re-answered by a separate agent
   that never saw the answer key, with the options reshuffled so position could
   not be exploited. 7 were dropped for genuine ambiguity; see `dropped.json`
   for each one and why.
3. **Source spot-check** — 45 of the survivors, weighted towards hard, were
   checked against Wikipedia, Britannica, WHO, UEFA, MoMA, Cleveland Clinic and
   others. 45/45 correct.

Zero errors in 45 puts the true error rate under roughly 7% with 95%
confidence. It does not prove zero. Steps 1 and 2 catch carelessness; they
cannot catch a belief the generator and the verifier both hold wrongly, which
is what step 3 exists to sample.

## Loading them
500 are already in Supabase as drafts. To load the rest:

    export SUPABASE_SERVICE_KEY='...'   # Project Settings -> API -> service_role
    node load.mjs

Safe to run twice — it skips any prompt already in the table. Everything lands
as `status = 'draft'`, so the app serves none of it until you publish.

## Publishing
Review first, then publish a category at a time rather than all at once:

    select category_id, difficulty, count(*) from puzzles where status='draft' group by 1,2;
    update puzzles set status='live' where status='draft' and category_id=12;  -- World

## Topping up later
`SPEC.md` is the brief a generator must follow; `VERIFY.md` is the brief for the
blind checker. Point agents at those two files, drop the output in `bank/`, and
run `load.mjs` again. That is the whole pipeline.
