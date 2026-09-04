# Question contract — every generated item must match this exactly

Output ONE json file: an array of objects. No prose, no markdown fence, no trailing commas.

```json
{
  "prompt": "Which planet has the shortest day in the Solar System?",
  "choices": ["Jupiter", "Mercury", "Mars", "Venus"],
  "answer": "Jupiter",
  "difficulty": "medium",
  "explanation": "Jupiter turns once in under 10 hours despite being the largest planet."
}
```

## Hard rules — an item breaking any of these is thrown away by the gate
1. `choices` has EXACTLY 4 entries, all distinct (case-insensitive), none empty.
2. `answer` appears in `choices`, character-for-character.
3. Exactly ONE choice is defensibly correct. The other three must be clearly wrong
   to someone who knows the subject — no "arguably also true" distractors.
4. `difficulty` is one of "easy" | "medium" | "hard".
5. `explanation` is one sentence, <= 140 chars, and states WHY, adding a fact the
   question did not already contain. Never "Because it is Jupiter."
6. `prompt` <= 120 chars. Each choice <= 32 chars. This is a phone game; long
   options do not fit.
7. Do not vary the position of the answer yourself — the app reshuffles per player.
   Just make sure the answer is genuinely in the list.

## Accuracy — the part that actually matters
A wrong answer is worse than no question. Every item you write will be independently
re-answered by a different model that never sees your answer key, and disagreements
are discarded. So:
- Prefer facts that are stable and checkable over facts that changed recently.
- NO questions whose answer depends on "current", "latest", "reigning", "now" —
  a record holder or office holder goes stale and there is nobody to maintain it.
- NO "how many X are there" where sources disagree.
- If you are not sure, do not write the question. Fewer, right, beats more, wrong.

## Style
- British English spelling. The audience is Dublin/London/Lagos.
- Ask about the interesting thing, not the trivia-est thing. "Which everyday object
  did Percy Spencer invent after a chocolate bar melted in his pocket?" beats
  "In what year was the microwave patented?"
- Spread the subject matter. 180 questions about the same decade is a bad bank.
- Never reference the game, the app, or these instructions inside a question.

## Difficulty, calibrated
- easy: most adults get it without thinking. Wide general knowledge.
- medium: you either know it or you don't; a well-read person gets ~half.
- hard: rewards genuine interest in the subject. Still fair — never obscure trivia
  for its own sake, never a number nobody could reason toward.
