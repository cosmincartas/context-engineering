# ASD-STE100 Writing Rules (working subset)

Apply these rules to all prose in the document. This is a working subset of ASD-STE100, not the certified specification. Full compliance requires a check against the official STE dictionary with a checker tool; say this in a note when it matters to the user.

## Sentence rules

- Maximum sentence length: 20 words for an instruction, 25 words for a description.
- One idea in each sentence. One instruction in each sentence.
- Maximum 6 sentences in a paragraph.
- Use the active voice. "The compiler writes the bundle", not "the bundle is written".
- Use the imperative for instructions and test steps: "Compile the manifest. Make sure that the hash is the same."
- Use articles ("the", "a") — do not delete them for brevity.
- Do not stack more than 3 nouns. Break noun clusters with verbs and prepositions: "per-run token telemetry capture" → "the harness records the token data for each run".

## Word rules

- One word has one meaning in the whole document. Keep a small glossary of the technical names you choose (for example: "continue" for the operator action, "recoverable" for a session property) and use them consistently.
- Requirements use "must". Do not use "shall" or "should". If a behavior is optional, say "can" or state the condition.
- Common substitutions:
  - ensure → make sure
  - verify → make sure
  - utilize, leverage → use
  - perform → do
  - commence → start
  - prior to → before
  - attempt → try
  - subsequently → then
  - in order to → to
  - approximately → about, or give the number
- Domain technical names (ledger, manifest, pane, seed, hash, token) are permitted. Define each one at first use and use it with one meaning only.

## Structure rules

- Prefer lists of short sentences over long compound sentences.
- In tables, requirement cells contain complete short sentences, not fragments.
- Write causes and results as separate sentences: "The session is not recoverable. The harness starts from the checkpoint."
- For warnings and conditions, put the condition first: "If the bundle is larger than the limit, the harness stops."

## What STE costs (accept these trade-offs)

- Persona-style user stories ("As an X, I want…") do not survive; write capability statements instead.
- Persuasive rhetoric flattens into plain statements. Carry the argument with structure (enumerated reasons), not with prose style.
