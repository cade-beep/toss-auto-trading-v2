# Services Knowledge Base

## Overview

`services/` contains business service abstractions for trading, market data, and AI strategy support. Keep these services decoupled from dashboard rendering and Supabase UI hydration.

## Structure

```text
services/
├── ai/        # strategy-engine and backtester stubs
├── market/    # StreamManager mock price stream
└── trading/   # TradingService contract and adapters
```

## Where To Look

| Task | Location | Notes |
| --- | --- | --- |
| Adapter contract | `trading/interface.ts` | Stable `TradingService` API: place/cancel/balance/positions/price. |
| Mode routing | `trading/index.ts` | Currently `LIVE` vs mock by `NEXT_PUBLIC_TRADING_MODE`. |
| Simulation adapter | `trading/mock-sandbox.ts` | Mock order and market-price responses. |
| Future Toss integration | `trading/toss-api.ts` | Must remain the only path to real broker submission. |
| Price streaming | `market/stream-manager.ts` | Current client-side mock drift source. |
| Strategy stubs | `ai/strategy-engine.ts` | Emits placeholder strategy configs/signals. |
| Backtesting stub | `ai/backtester.ts` | Returns sample metrics/trades. |

## Conventions

- Preserve `TradingService` unless a migration plan explicitly changes callers and types.
- Add Paper Trading as a new adapter beside mock and Toss; never make Paper call broker order endpoints.
- Keep market data concerns behind a future `MarketDataProvider`; do not let strategies call broker/quote APIs directly.
- Strategy workers should produce order intents, then pass through Risk Engine before `TradingService`.

## Anti-Patterns

- Do not settle cash or positions in service adapters directly.
- Do not put broker credentials in browser-readable code or `NEXT_PUBLIC_*`.
- Do not let future live code bypass Broker Order Mapping, Risk Engine, or reconciliation.
