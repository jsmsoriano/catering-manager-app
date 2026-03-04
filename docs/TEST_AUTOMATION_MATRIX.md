# Test Automation Matrix

## Scope and objective
This matrix prioritizes the highest-risk business flows in the catering app:
- Lead intake and qualification
- Quote generation and client portal interactions
- Event confirmation gates (deposit + menu approval)
- Operations readiness (menu/staff/packing/shopping)

## Test pyramid
- Unit (`vitest`): policy logic, pricing math, workflow guards
- API/Integration (`vitest` + route handlers): proposal and menu-change endpoints
- E2E (`playwright`): end-to-end user workflows across UI pages

## Priority matrix
| Area | Risk | Automation level | Status |
|---|---|---|---|
| Inquiry intake (form + chat) | High | E2E smoke + regression | Smoke scaffolded |
| Lead queue to quote preview | High | E2E smoke | Smoke scaffolded |
| Client portal accept + requests | High | E2E smoke + API | Smoke scaffolded |
| Guest cutoff policy | High | Unit + API | Unit scaffolded |
| Menu cutoff/request policy | High | Unit + API | Unit scaffolded |
| Event confirm gating rules | High | E2E + unit | Smoke scaffolded |
| Staff conflicts/double-booking | Medium | Unit + E2E | Planned |
| Shopping/packing generation | Medium | Unit + E2E | Planned |
| Reports/funnel aggregates | Medium | Unit | Planned |
| Email rendering + send fallback | Medium | Integration | Planned |

## Recommended regression suites
### Smoke (run every PR)
- Inquiry page renders and date field min blocks past dates.
- Notifications lead queue can load test inquiries.
- Quote preview opens and can send quote (fallback local token path accepted).
- Client portal accepts menu change request.
- Event confirmation remains blocked until prerequisites are met.

### Core regression (daily/nightly)
- Full lead lifecycle: New lead -> Qualified -> Quote sent -> Accepted -> Confirmed.
- Guest count update before and after cutoff.
- Menu change request before and after cutoff, manager approve/decline.
- Event menu approval gates confirmation.
- Payment updates impact confirmation state.

### Extended regression (pre-release)
- Multi-profile behavior (Hibachi vs Caterer Pro modules).
- Online ordering flow through order management.
- Packing checklist + shopping sync behavior.
- Reports sanity checks (sales funnel, orders, owner monthly).

## Data strategy
- Deterministic seeded fixtures via localStorage and test actions (`Load Test` buttons).
- Keep one baseline fixture per product mode:
  - `hibachi-private-dinner`
  - `hibachi-buffet`
  - `catering-dropoff`
  - `catering-full-service`
- Freeze timestamps in unit tests for cutoff boundaries.

## CI quality gates
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:e2e` (or smoke subset) on PR and main

## Exit criteria
- No failing smoke tests on PR.
- No high-severity open defects on lead->quote->confirm workflow.
- Cutoff policy tests pass for both guest and menu changes.
