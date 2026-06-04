# Components Knowledge Base

## Overview

`components/` is the workstation UI surface. It should feel like an operational trading terminal, not a marketing dashboard.

## Structure

```text
components/
├── dashboard/  # portfolio, watchlist, chart, positions, order ticket, AI strategies
├── layout/     # header and footer/status surfaces
└── ui/         # reusable primitives and error boundary
```

## Where To Look

| Task | Location | Notes |
| --- | --- | --- |
| Dashboard shell | `dashboard/workstation-dashboard.tsx` | Main composition surface. |
| Manual orders | `dashboard/order-ticket.tsx` | Currently tracks order side/type/qty/price locally. |
| Positions actions | `dashboard/positions.tsx` | Contains quick close/sell interactions. |
| Portfolio valuation | `dashboard/portfolio.tsx` | Uses context positions and ticker prices. |
| Watchlist | `dashboard/watchlist.tsx` | Reads and mutates context watchlist state. |
| Chart | `dashboard/market-chart.tsx` | Visualizes active ticker history. |
| Strategy panel | `dashboard/ai-strategies.tsx` | Shows/toggles current MA/RSI simulation flags. |
| Error recovery | `ui/error-boundary.tsx` | Includes localStorage clear recovery action. |

## Conventions

- Use compact, scan-friendly layouts and restrained styling.
- Keep cards shallow; avoid nesting card-like containers.
- Use existing context shape before introducing local duplicate state.
- If changing order workflows, preserve or explicitly migrate `executeMockTrade` callers.

## Anti-Patterns

- Do not add landing-page or hero-section patterns to the workstation.
- Do not obscure trading state with decorative visuals.
- Do not make client UI the source of truth for fills, risk decisions, or broker order state.
