# Lib Knowledge Base

## Overview

`lib/` contains shared app infrastructure. The central file is `lib/context/workstation-context.tsx`, which currently owns much of the workstation runtime state.

## Where To Look

| Task | Location | Notes |
| --- | --- | --- |
| Workstation state | `context/workstation-context.tsx` | Reducer, hydration, Supabase sync, localStorage, AI simulation interval. |
| Supabase browser client | `supabase/client.ts` | Uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. |

## Context Notes

- Auth-disabled development mode creates a mock user.
- Auth-enabled mode loads portfolio, positions, watchlist, and orders from Supabase.
- Authenticated trade execution currently calls `supabase.rpc('execute_trade', ...)`.
- Local simulation mode mutates reducer state and persists pieces to localStorage.
- The file is large; isolate changes and re-read nearby reducer/actions before editing.

## Anti-Patterns

- Do not expose service-role keys or broker secrets in `NEXT_PUBLIC_*`.
- Do not use localStorage as a recovery queue for real broker or paper order execution.
- Do not add new server-authoritative trading behavior to client context; move it behind server/RPC/service boundaries.
