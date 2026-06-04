# Plan: Trading Architecture Documentation And Implementation Roadmap

## Objective

Create production-grade architecture documentation and an implementation roadmap for PaperTradingService, Risk Engine, MarketDataProvider, Strategy Worker, and Broker Order Mapping while preserving the current `TradingService` interface, `execute_trade` RPC settlement flow, and Simulation mode.

## Scope

IN:

- Add architecture documentation under `docs/architecture/`.
- Add implementation roadmap under `docs/roadmap/`.
- Cross-link docs from `README.md` and/or `architecture_plan.md`.
- Preserve current production code behavior.
- Define QA commands for doc completeness and architecture boundary checks.

OUT:

- No service implementation.
- No Supabase migration changes.
- No changes to `TradingService` interface.
- No changes to `execute_trade`.
- No Toss Open API integration.

## Non-Negotiable Preservation Rules

- `services/trading/interface.ts` remains the adapter contract.
- `supabase/migrations/20260602000000_init_schema.sql` remains the source for current `execute_trade` RPC behavior.
- Simulation mode must continue working through existing local/mock paths.
- Paper mode must never submit real broker orders.
- Future Live mode must enter through `TossTradingService` only.
- Future cash/position settlement must call `execute_trade` once per accepted fill.

## Planned Documentation Layout

Create these files:

```text
docs/
|-- architecture/
|   |-- README.md
|   |-- 00-system-overview.md
|   |-- 01-paper-trading-service.md
|   |-- 02-risk-engine.md
|   |-- 03-market-data-provider.md
|   |-- 04-strategy-worker.md
|   `-- 05-broker-order-mapping.md
`-- roadmap/
    `-- trading-platform-implementation-roadmap.md
```

Update:

```text
README.md
architecture_plan.md
```

Only add links/summaries in existing root docs. Keep detailed architecture under `docs/`.

## Key Decisions

1. Documentation-first: create architecture docs before any runtime implementation.
2. Server-authoritative trading: Paper/Live execution, risk decisions, recovery queues, and broker mapping must move out of browser-local authority.
3. Settlement invariant: `execute_trade` remains the database settlement primitive.
4. Mode separation: Simulation, Paper, and Live must share orchestration contracts but differ in data source and order submission behavior.
5. Audit-first design: every order intent, risk decision, quote snapshot, broker mapping, fill, cancellation, replacement, and reconciliation event must be traceable.

## Wave 1: Documentation Scaffold

### Task 1.1: Create `docs/architecture/README.md`

Content:

- Explain architecture documentation purpose.
- Include ordered reading path.
- Link all architecture docs.
- State preservation rules for `TradingService`, `execute_trade`, and Simulation mode.

Acceptance:

- File exists.
- Contains links to all six architecture docs.
- Contains the phrase `execute_trade`.
- Contains the phrase `TradingService`.

QA:

```bash
test -f docs/architecture/README.md
grep -q "execute_trade" docs/architecture/README.md
grep -q "TradingService" docs/architecture/README.md
```

### Task 1.2: Create `docs/architecture/00-system-overview.md`

Content:

- Current architecture summary from actual repo.
- Target architecture diagram covering Strategy Worker, MarketDataProvider, Risk Engine, TradingService, Broker Order Mapping, and `execute_trade`.
- Mode matrix for Simulation, Paper, Live.

Acceptance:

- Names all five target systems.
- Includes a mode matrix.
- Explicitly states browser state is not authoritative for Paper/Live execution.

QA:

```bash
grep -q "Strategy Worker" docs/architecture/00-system-overview.md
grep -q "MarketDataProvider" docs/architecture/00-system-overview.md
grep -q "Risk Engine" docs/architecture/00-system-overview.md
grep -q "Broker Order Mapping" docs/architecture/00-system-overview.md
```

## Wave 2: Core Architecture Docs

### Task 2.1: Create `01-paper-trading-service.md`

Required sections:

- Service architecture
- State transitions
- Fill simulation model
- Database interactions
- Failure modes

Required decisions:

- Paper uses real market data.
- Paper never submits real broker orders.
- Partial fills create execution records.
- Each accepted fill settles through `execute_trade`.
- Public `TradingService` interface remains unchanged.

QA:

```bash
grep -q "never submits real broker orders" docs/architecture/01-paper-trading-service.md
grep -q "partial fills" docs/architecture/01-paper-trading-service.md
grep -q "execute_trade" docs/architecture/01-paper-trading-service.md
```

### Task 2.2: Create `02-risk-engine.md`

Required sections:

- Overview
- Pre-trade validation
- Post-trade validation
- Strategy controls
- Portfolio controls
- Emergency controls
- State machine
- Failure modes
- Audit logging

Required controls:

- max position size
- max order value
- max daily loss
- max portfolio exposure
- strategy-level limits
- symbol-level limits
- emergency kill switch
- trading halt mode
- broker disconnect mode

QA:

```bash
grep -q "max position size" docs/architecture/02-risk-engine.md
grep -q "emergency kill switch" docs/architecture/02-risk-engine.md
grep -q "broker disconnect mode" docs/architecture/02-risk-engine.md
```

### Task 2.3: Create `03-market-data-provider.md`

Required sections:

- Provider overview
- Provider abstraction
- Market data modes
- Quote cache architecture
- Real-time update flow
- WebSocket management
- Fallback polling
- Stale data detection
- Audit and provenance

Required decisions:

- Simulation can use mock generator.
- Paper and Live require freshness checks.
- Trading decisions consume canonical quote snapshots.
- UI subscriptions are not authoritative for trading.

QA:

```bash
grep -q "stale" docs/architecture/03-market-data-provider.md
grep -q "quote snapshot" docs/architecture/03-market-data-provider.md
grep -q "WebSocket" docs/architecture/03-market-data-provider.md
```

## Wave 3: Orchestration And Mapping Docs

### Task 3.1: Create `04-strategy-worker.md`

Required sections:

- Worker overview
- Worker lifecycle
- Strategy execution flow
- Scheduling architecture
- Risk Engine integration
- MarketDataProvider integration
- TradingService integration
- State machine
- Failure modes
- Recovery procedures
- Audit logging
- Multi-strategy scaling

Required decisions:

- Strategies produce order intents, not direct broker calls.
- All trade intents pass through Risk Engine.
- AI, rule-based, and custom strategies use the same normalized signal contract.
- Custom strategies cannot access broker credentials, Supabase secrets, or `execute_trade` directly.

QA:

```bash
grep -q "order intents" docs/architecture/04-strategy-worker.md
grep -q "Risk Engine" docs/architecture/04-strategy-worker.md
grep -q "custom strategies" docs/architecture/04-strategy-worker.md
```

### Task 3.2: Create `05-broker-order-mapping.md`

Required sections:

- Architecture overview
- Order mapping schema
- Order lifecycle
- Partial fill handling
- Cancellation flow
- Replacement flow
- Reconciliation flow
- Idempotency strategy
- Failure modes
- Recovery procedures
- Audit logging
- Broker integration boundaries

Required concepts:

- `client_order_id`
- `broker_order_id`
- synthetic ids for Simulation/Paper
- partial/full fills
- cancellations
- replacements
- reconciliation
- idempotency

QA:

```bash
grep -q "client_order_id" docs/architecture/05-broker-order-mapping.md
grep -q "broker_order_id" docs/architecture/05-broker-order-mapping.md
grep -q "Replacement" docs/architecture/05-broker-order-mapping.md
```

## Wave 4: Roadmap And Cross-Links

### Task 4.1: Create `docs/roadmap/trading-platform-implementation-roadmap.md`

Roadmap phases:

1. Documentation and contract hardening.
2. Server-side order intent gateway.
3. MarketDataProvider abstraction and cache.
4. PaperTradingService and fill engine.
5. Risk Engine pre/post-trade controls.
6. Broker Order Mapping and reconciliation.
7. Strategy Worker orchestration.
8. Live Toss Open API adapter integration.
9. Disaster recovery, audit, and operator controls.

Each phase must include:

- goal
- prerequisites
- files/modules affected
- acceptance criteria
- automated QA
- manual QA
- rollback notes

QA:

```bash
grep -q "Phase 1" docs/roadmap/trading-platform-implementation-roadmap.md
grep -q "PaperTradingService" docs/roadmap/trading-platform-implementation-roadmap.md
grep -q "Live Toss Open API" docs/roadmap/trading-platform-implementation-roadmap.md
```

### Task 4.2: Update `README.md`

Add:

- Short project-specific summary replacing generic create-next-app text.
- Link to `docs/architecture/README.md`.
- Link to `docs/roadmap/trading-platform-implementation-roadmap.md`.
- Preserve dev command instructions.

QA:

```bash
grep -q "docs/architecture/README.md" README.md
grep -q "docs/roadmap/trading-platform-implementation-roadmap.md" README.md
grep -q "npm run dev" README.md
```

### Task 4.3: Update `architecture_plan.md`

Add:

- A note that detailed architecture docs now live in `docs/architecture/`.
- A note that implementation sequencing lives in `docs/roadmap/`.
- Do not duplicate full docs content.

QA:

```bash
grep -q "docs/architecture" architecture_plan.md
grep -q "docs/roadmap" architecture_plan.md
```

## Wave 5: Verification

Run these checks after all doc work:

```bash
test -f docs/architecture/README.md
test -f docs/architecture/00-system-overview.md
test -f docs/architecture/01-paper-trading-service.md
test -f docs/architecture/02-risk-engine.md
test -f docs/architecture/03-market-data-provider.md
test -f docs/architecture/04-strategy-worker.md
test -f docs/architecture/05-broker-order-mapping.md
test -f docs/roadmap/trading-platform-implementation-roadmap.md
grep -R "execute_trade" docs/architecture docs/roadmap
grep -R "TradingService" docs/architecture docs/roadmap
grep -R "Simulation" docs/architecture docs/roadmap
```

Manual QA channel for data-shaped docs:

```bash
sed -n '1,220p' docs/architecture/README.md
sed -n '1,260p' docs/roadmap/trading-platform-implementation-roadmap.md
```

Pass condition:

- The architecture index presents the expected reading order.
- The roadmap contains all nine phases.
- The docs explicitly preserve `TradingService`, `execute_trade`, and Simulation mode.

## Implementation Notes For The Next Worker

- This plan is documentation-only. Do not implement runtime code while executing it.
- Use `apply_patch` for manual doc edits.
- Do not modify generated or dependency directories.
- If adding test infrastructure becomes necessary, create a separate plan first.
- Preserve existing uncommitted `AGENTS.md` hierarchy unless the user asks to revert it.

## Defaults Applied

- No user interview needed: the requested architecture categories and preservation constraints are explicit.
- Docs live under `docs/architecture/` and `docs/roadmap/` because current root docs are already overloaded.
- Roadmap is phased from safest contracts to live broker integration.

## Decisions Needed

None.
