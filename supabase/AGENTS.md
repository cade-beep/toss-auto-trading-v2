# Supabase Knowledge Base

## Overview

`supabase/` owns database schema, RLS, and transaction settlement. This area is security-sensitive because it controls cash, positions, and trade logs.

## Where To Look

| Task | Location | Notes |
| --- | --- | --- |
| Initial schema | `migrations/20260602000000_init_schema.sql` | Creates tables, RLS policies, and `execute_trade`. |

## Current Schema

- `portfolio`: one row per user with `cash_balance`.
- `positions`: per-user symbol holdings with `qty` and `avg_buy_price`.
- `watchlist`: per-user tracked symbols.
- `orders_log`: filled/rejected/cancelled order log.

## execute_trade Rules

- `execute_trade` is `security definer` and reads `auth.uid()`.
- It locks `portfolio` with `FOR UPDATE`.
- It validates cash for buys and holdings for sells.
- It mutates `portfolio` and `positions`.
- It inserts a filled order row into `orders_log`.

## Conventions

- Every exposed public table needs RLS.
- Future Paper/Live execution ledgers should call `execute_trade` once per accepted fill with a unique execution id.
- Use durable order/execution/mapping tables for partial fills, cancellations, replacements, and reconciliation.

## Anti-Patterns

- Do not bypass `execute_trade` for cash/position settlement.
- Do not add security-definer functions casually in exposed schemas.
- Do not rely on browser state for authoritative order recovery.
