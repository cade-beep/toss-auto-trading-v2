# init-deep Notepad

## Goal

Generate hierarchical AGENTS.md knowledge base files for the Toss auto trading workstation.

## Skills Used

- `init-deep`: required by the user's explicit skill invocation; used to create root and complexity-scored subdirectory AGENTS.md files.
- `ulw-plan`: previous request was superseded by `init-deep`; no plan artifact generated.
- Supabase guidance: applied conceptually for RLS/`execute_trade` safety notes.

## Findings

- Root `AGENTS.md` existed from the prior `/init-deep` attempt and was updated instead of overwritten blindly.
- Distinct context boundaries requiring subdirectory guidance: `services`, `components`, `lib`, `supabase`.
- Product code was not changed; this is a documentation/context-only task.

## RED Evidence

Command:

```bash
printf 'Required context files:\n'; for f in services/AGENTS.md components/AGENTS.md supabase/AGENTS.md; do test -f "$f" && echo "PASS $f" || { echo "FAIL missing $f"; exit 1; }; done
```

Result:

```text
Required context files:
FAIL missing services/AGENTS.md
```

## GREEN Evidence

Command:

```bash
printf 'Required context files:\n'; for f in services/AGENTS.md components/AGENTS.md supabase/AGENTS.md lib/AGENTS.md; do test -f "$f" && echo "PASS $f" || { echo "FAIL missing $f"; exit 1; }; done
```

Result:

```text
Required context files:
PASS services/AGENTS.md
PASS components/AGENTS.md
PASS supabase/AGENTS.md
PASS lib/AGENTS.md
```

## Manual QA Artifact

Data-shaped CLI surface: `grep`/`wc` inspection over generated files.

Observable: generated files contain expected core terms (`execute_trade`, `TradingService`, `Where To Look`, `Anti-Patterns`, `RLS`, `Paper`) and root stays within init-deep target length after trimming.
