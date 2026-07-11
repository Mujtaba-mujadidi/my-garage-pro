# Bootstrap project context

You are starting work on **MyGaragePro**. Load full project context before doing anything else.

## Step 1 — Read these files completely

@AGENTS.md
@docs/PROGRESS.md
@docs/CODING_STANDARDS.md

Follow the bootstrap sequence in `AGENTS.md`. Treat `docs/PROGRESS.md` (especially the header, decision log, and current gate) as the source of truth for **what we are building now**. Apply `docs/CODING_STANDARDS.md` for **how** you write code.

## Step 2 — Module doc (if applicable)

If the user typed a module name after `/context`, also read that module’s handoff:

| User says | Read |
|-----------|------|
| `pco` | @docs/PCO_MODULE.md |

If no module is named, skip this step unless the user’s task clearly belongs to a module above.

## Step 3 — Do not invent

Requirements come only from: this chat, `PROGRESS.md` decision log, module handoff docs, targeted sections of `docs/PROJECT_PLAN.md`, and existing code. Do not add fields, endpoints, enums, or business rules without agreement.

## Step 4 — Reply briefly, then continue

Reply with a **short** confirmation (max 5 bullets):

- Current phase / gate / branch (from `PROGRESS.md` header)
- Active backlog item if obvious
- 1–2 relevant decision-log entries for the user’s task (if any)
- Which module doc you read (if any)
- “Ready — no requirements invented.”

**If the user included a task** after `/context` (e.g. `/context fix the duplicate VRM bug` or `/context pco add notes field`), proceed with that task immediately after the confirmation.

**If the user only ran `/context`** with no task, stop after the confirmation and wait for their next message.
