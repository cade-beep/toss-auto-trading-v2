# Draft: Trading Architecture Docs And Roadmap

## Requirements Confirmed

- User requested `ulw-plan`.
- Preserve current `TradingService`, `execute_trade` RPC, and Simulation mode.
- Plan docs for PaperTradingService, Risk Engine, MarketDataProvider, Strategy Worker, Broker Order Mapping.
- Include an implementation roadmap.

## Technical Decisions

- This is a planning artifact only. Do not implement services or schema in this plan run.
- Future documentation should live under `docs/architecture/` and `docs/roadmap/`.
- The implementation roadmap should sequence server-side safety foundations before live broker integration.

## Research Findings

- `services/trading/interface.ts` defines the preserved adapter surface.
- `supabase/migrations/20260602000000_init_schema.sql` defines current persistence and `execute_trade`.
- `lib/context/workstation-context.tsx` currently owns client simulation, Supabase hydration, and direct RPC execution.
- `AGENTS.md` and subdirectory `AGENTS.md` files now document repository boundaries.

## Scope Boundaries

- INCLUDE: plan for architecture docs and roadmap creation.
- INCLUDE: acceptance criteria and QA commands for generated docs.
- EXCLUDE: implementation code, database migration changes, runtime behavior changes.

## Open Questions

- None. Defaults applied from user-provided architecture sequence and repository context.
