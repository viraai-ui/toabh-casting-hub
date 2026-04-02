# TOABH Casting Hub Mobile Responsive Audit Design

## Summary

Redesign the TOABH Casting Hub experience for all widths below `1024px` by standardizing the shared app shell first and then applying targeted page rewrites where the current desktop-first layouts break mobile and tablet usability.

## Chosen Direction

Use an app-shell-first responsive redesign with targeted page rewrites.

This direction was chosen because:

- the board wants a full app audit, not a single-page patch
- broad mobile divergence from desktop is explicitly allowed
- the repo already contains some isolated mobile work, so the biggest remaining risk is inconsistency in shared shell, navigation, and page patterns
- shell-first standardization reduces the chance of every route solving mobile constraints differently

## Dashboard Workflow

UI direction should go to the UI UX Pro first for the shared shell and the highest-risk responsive patterns. Stitch should be the baseline reference for mobile layout structure and component rhythm. React Bits should be used selectively and only where it materially improves interaction quality for drawers, sheets, filters, or similar mobile controls.

## Architecture

The responsive redesign should be organized around three layers:

1. Shared shell behavior in `src/components/layout/*` and global spacing/style rules in `src/index.css`
2. Shared interaction patterns for filters, modals, dense data views, and overflow handling in reusable components
3. Route-level rewrites in `src/pages/*` only where the shell and shared patterns are not enough

Desktop remains the information-architecture reference, but page layouts below `1024px` are allowed to diverge when the desktop composition is not usable on phones or tablets.

## Scope

### In scope

- shared responsive layout behavior below `1024px`
- header, bottom navigation, page padding, and mobile action prioritization
- route-by-route responsive audit for:
  - `src/pages/Dashboard.tsx`
  - `src/pages/Castings.tsx`
  - `src/pages/Clients.tsx`
  - `src/pages/Calendar.tsx`
  - `src/pages/Team.tsx`
  - `src/pages/ActivityLog.tsx`
  - `src/pages/Reports.tsx`
  - `src/pages/Settings.tsx` and nested settings pages
- responsive updates for supporting UI such as modals, filters, and board/list/table patterns
- route-level acceptance checks at representative phone, tablet, and near-desktop widths

### Out of scope

- desktop redesign above `1024px`
- backend or API changes unrelated to responsive behavior
- unrelated visual restyling that does not improve sub-desktop usability

## Design Rules

### Shared shell

- The shell becomes the primary control surface for sub-desktop layouts.
- Header actions should prioritize search, page identity, and one primary action path where needed.
- Navigation should remain reachable without relying on desktop-only sidebar behavior.
- Spacing and page padding should scale by breakpoint instead of relying on one desktop rhythm.

### Dense data and controls

- Dense table-like layouts should not remain unchanged below desktop.
- Filters and secondary actions should move into sheets, drawers, or compact disclosures when they compete with content width.
- Overloaded page headers should promote one primary action and demote the rest into overflow or contextual controls.

### Modals and overlays

- Desktop modals that clip on small screens should become full-height or near-full-height mobile sheets.
- Overlay behavior should avoid nested scrolling traps and preserve clear dismissal paths.

### Visualizations and complex views

- Charts, kanban, and calendar layouts may keep richer behavior on larger tablets, but must simplify labels, legends, and controls on narrow screens.
- Intentional horizontal scroll is acceptable only when bounded and when core actions remain visible.

## Acceptance Criteria

1. No broken navigation, clipped dialogs, unusable forms, or accidental horizontal overflow below `1024px`.
2. Primary actions remain discoverable and reachable across audited routes.
3. Tap targets, spacing, and text density are comfortable on phones and still coherent on tablets.
4. Shared responsive patterns are reused so the product still feels consistent route to route.
5. Each route is checked at representative phone, tablet, and near-desktop widths before implementation handoff is considered complete.

## Risks

1. Several routes may already have partial mobile fixes, which can create pattern drift if shell rules are not normalized first.
2. Data-dense pages such as Castings, Reports, and Team may require real layout divergence rather than cosmetic shrinking.
3. Modal and overlay coordination may regress if mobile sheets are introduced without respecting the existing overlay manager.

## Success Criteria

1. A Lead Engineer can execute the responsive audit from an explicit plan with exact file targets.
2. Shared shell and interaction rules are clear enough for UI UX and engineering to work from the same direction.
3. The resulting implementation can be handed to QA with route-level responsive expectations, not vague “looks better on mobile” language.
