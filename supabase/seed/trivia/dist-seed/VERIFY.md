# Blind verification — you are the check, not the author

You are given a file of multiple-choice questions with **no answer key**. Someone
else wrote them. Your job is to answer each one yourself and, separately, to say
whether the question is fair. Where your answer disagrees with theirs, the
question is thrown away. So a careless "sure" from you costs a good question,
and a careless answer lets a wrong one through to real players.

## Do not
- Do NOT open, read, glob or grep anything in `gated/` or `raw/`. The answer key
  lives there and reading it makes this whole step worthless. Only read the one
  blind file you were given.
- Do NOT assume the first option is right. The options have been shuffled.
- Do NOT skip questions or answer in bulk patterns. Each one on its own merits.

## For every question, decide three things
1. **pick** — the exact text of the option you believe is correct, copied
   character-for-character from `choices`.
2. **sure** — `true` if you are confident. `false` if you are guessing, or if the
   fact is one you would want to look up. `false` is not a failure; it is the
   signal that the question is riskier than it looks.
3. **ambiguous** — `true` if MORE THAN ONE option is defensibly correct, or the
   question is worded so that a knowledgeable person could reasonably pick a
   different option. This is as damaging as a wrong key, so flag it honestly.
   Add a short `note` saying which other option also works and why.

Also set `ambiguous: true` with a note if the question is unanswerable, depends on
a date not given, contains a factual error in the *question* itself, or would go
stale as records change.

## Output
Write ONE json file, an array, same order as the input, one entry per question:

```json
[ { "i": 0, "pick": "Jupiter", "sure": true, "ambiguous": false },
  { "i": 1, "pick": "1969", "sure": false, "ambiguous": true, "note": "1968 also defensible — the question does not say which mission" } ]
```

`i` must match the `i` from the input. Every question gets an entry. No prose
outside the file.
