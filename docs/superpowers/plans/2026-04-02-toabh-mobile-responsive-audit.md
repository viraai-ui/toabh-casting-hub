# TOABH Casting Hub Mobile Responsive Audit Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard usable and consistent on every route below `1024px` by redesigning the shared shell first and then applying targeted responsive rewrites to high-risk pages and overlays.

**Architecture:** Normalize shared shell behavior in the layout components and global styles, then update page-level patterns for dense views, filters, and modals where the desktop composition does not survive sub-desktop widths. Keep desktop information architecture intact while allowing meaningful mobile/tablet layout divergence.

**Tech Stack:** React 19, React Router 7, TypeScript, Tailwind CSS 4, Framer Motion, MUI Select, Zustand

---

## File Map

- `src/components/layout/AppLayout.tsx`: main page frame, content padding, top/bottom spacing rules
- `src/components/layout/Header.tsx`: mobile header controls, action prioritization, user menu behavior
- `src/components/layout/BottomNav.tsx`: mobile navigation, more sheet behavior, action access
- `src/components/layout/Sidebar.tsx`: desktop-only behavior and breakpoint handoff with mobile nav
- `src/index.css`: shared responsive tokens, overflow safeguards, utility classes if needed
- `src/pages/Dashboard.tsx`: mobile dashboard cards, chart sections, activity layout
- `src/pages/Castings.tsx`: dense toolbar, view toggles, filters, list/grid/kanban responsiveness
- `src/pages/Clients.tsx`: client cards, action layout, expanded detail responsiveness
- `src/pages/Calendar.tsx`: verify current mobile work still fits shared shell rules
- `src/pages/Team.tsx`: responsive review and likely list/card adaptation
- `src/pages/ActivityLog.tsx`: responsive review and action density cleanup
- `src/pages/Reports.tsx`: dense data/chart responsive adaptation
- `src/pages/Settings.tsx`: top-level settings route shell verification
- `src/pages/settings/*.tsx`: verify nested settings pages still align with the updated shell
- `src/components/AdvancedFilters.tsx`: mobile filter presentation and scroll behavior
- `src/components/CastingModal.tsx`: mobile sheet/full-height modal behavior
- `src/components/CastingDetailModal.tsx`: detail modal responsiveness and transition behavior

### Task 1: Shared Shell Responsive Baseline

**Files:**
- Modify: `src/components/layout/AppLayout.tsx`
- Modify: `src/components/layout/Header.tsx`
- Modify: `src/components/layout/BottomNav.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Audit current shell breakpoints and note conflicts**

Run: `sed -n '1,220p' src/components/layout/AppLayout.tsx && sed -n '1,260p' src/components/layout/Header.tsx && sed -n '1,240p' src/components/layout/BottomNav.tsx && sed -n '1,220p' src/components/layout/Sidebar.tsx`
Expected: clear list of padding, fixed positioning, and duplicated navigation behaviors to normalize

- [ ] **Step 2: Implement shared sub-desktop spacing and viewport rules**

Update `AppLayout.tsx` and `src/index.css` so the main content area has consistent top/bottom offsets, safe bottom navigation spacing, and no accidental horizontal overflow under `1024px`.

- [ ] **Step 3: Simplify the mobile header control surface**

Update `Header.tsx` so title sizing, action density, and user menu behavior remain usable on phones and tablets.

- [ ] **Step 4: Normalize mobile navigation and overflow behavior**

Update `BottomNav.tsx` and `Sidebar.tsx` so navigation responsibility is unambiguous by breakpoint and mobile actions remain reachable.

- [ ] **Step 5: Verify the shared shell changes**

Run: `npm run build`
Expected: successful production build with no TypeScript or Vite errors

- [ ] **Step 6: Commit the shell baseline**

Run:
```bash
git add src/components/layout/AppLayout.tsx src/components/layout/Header.tsx src/components/layout/BottomNav.tsx src/components/layout/Sidebar.tsx src/index.css
git commit -m "feat: add responsive shell baseline" -m "Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

### Task 2: Dashboard And Home-Screen Patterns

**Files:**
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1: Review dashboard sections at sub-desktop widths**

Run: `sed -n '1,320p' src/pages/Dashboard.tsx`
Expected: identify stat grid, chart row, and activity feed sections that need mobile/tablet-specific composition

- [ ] **Step 2: Refactor dashboard sections for responsive hierarchy**

Update stat cards, chart blocks, and bottom-row content so primary information remains readable without desktop width assumptions.

- [ ] **Step 3: Re-check chart overflow behavior**

Ensure charts use intentional container sizing, label simplification, or bounded scrolling instead of clipping.

- [ ] **Step 4: Verify dashboard changes**

Run: `npm run build`
Expected: successful build after dashboard updates

- [ ] **Step 5: Commit the dashboard pass**

Run:
```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: improve dashboard mobile layouts" -m "Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

### Task 3: Castings, Filters, And Modal Flows

**Files:**
- Modify: `src/pages/Castings.tsx`
- Modify: `src/components/AdvancedFilters.tsx`
- Modify: `src/components/CastingModal.tsx`
- Modify: `src/components/CastingDetailModal.tsx`
- Modify: `src/components/kanban/KanbanBoard.tsx`
- Modify: `src/components/kanban/KanbanColumn.tsx`
- Modify: `src/components/kanban/KanbanCard.tsx`

- [ ] **Step 1: Audit the castings route and related overlays**

Run: `sed -n '1,360p' src/pages/Castings.tsx && sed -n '1,260p' src/components/AdvancedFilters.tsx && sed -n '1,260p' src/components/CastingModal.tsx && sed -n '1,260p' src/components/CastingDetailModal.tsx`
Expected: clear list of toolbar density, filter presentation, and modal sizing problems

- [ ] **Step 2: Redesign toolbar and view switching for smaller widths**

Update `Castings.tsx` so search, filters, and primary actions remain usable without crowding the page header.

- [ ] **Step 3: Move dense controls into mobile-friendly disclosure patterns**

Update `AdvancedFilters.tsx` and related page state so filter controls behave as sheet/drawer/stacked content under sub-desktop constraints.

- [ ] **Step 4: Make casting modals behave like mobile sheets where needed**

Update `CastingModal.tsx` and `CastingDetailModal.tsx` to avoid clipping and nested-scroll traps on smaller screens.

- [ ] **Step 5: Rework kanban responsiveness**

Update the kanban components so horizontal scroll, lane sizing, and card actions remain intentional and usable.

- [ ] **Step 6: Verify the castings flow**

Run: `npm run build`
Expected: successful build after castings and overlay changes

- [ ] **Step 7: Commit the castings pass**

Run:
```bash
git add src/pages/Castings.tsx src/components/AdvancedFilters.tsx src/components/CastingModal.tsx src/components/CastingDetailModal.tsx src/components/kanban/KanbanBoard.tsx src/components/kanban/KanbanColumn.tsx src/components/kanban/KanbanCard.tsx
git commit -m "feat: improve castings mobile flows" -m "Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

### Task 4: Client, Team, Activity, And Reports Route Audit

**Files:**
- Modify: `src/pages/Clients.tsx`
- Modify: `src/pages/Team.tsx`
- Modify: `src/pages/ActivityLog.tsx`
- Modify: `src/pages/Reports.tsx`

- [ ] **Step 1: Review the remaining data-dense routes**

Run: `sed -n '1,320p' src/pages/Clients.tsx && sed -n '1,320p' src/pages/Team.tsx && sed -n '1,320p' src/pages/ActivityLog.tsx && sed -n '1,320p' src/pages/Reports.tsx`
Expected: list of routes that need card conversion, action compression, or chart/table adaptation

- [ ] **Step 2: Update clients for cleaner action density and expanded state behavior**

Refine `Clients.tsx` so action buttons, expanded details, and CTA rows remain readable and tappable on smaller widths.

- [ ] **Step 3: Update team, activity, and reports layouts**

Apply responsive card/list/chart patterns to the remaining routes without forcing desktop table layouts onto mobile screens.

- [ ] **Step 4: Verify the route audit pass**

Run: `npm run build`
Expected: successful build after these route updates

- [ ] **Step 5: Commit the route audit pass**

Run:
```bash
git add src/pages/Clients.tsx src/pages/Team.tsx src/pages/ActivityLog.tsx src/pages/Reports.tsx
git commit -m "feat: audit remaining mobile route layouts" -m "Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

### Task 5: Calendar And Settings Consistency Sweep

**Files:**
- Modify: `src/pages/Calendar.tsx`
- Modify: `src/pages/Settings.tsx`
- Modify: `src/pages/settings/DashboardSettings.tsx`
- Modify: `src/pages/settings/RolesPermissions.tsx`
- Modify: `src/pages/settings/PipelineStages.tsx`
- Modify: `src/pages/settings/TeamManagement.tsx`
- Modify: `src/pages/settings/EmailConfig.tsx`
- Modify: `src/pages/settings/EmailTemplates.tsx`
- Modify: `src/pages/settings/LeadSources.tsx`
- Modify: `src/pages/settings/CustomFields.tsx`

- [ ] **Step 1: Re-audit routes that already had mobile work**

Run: `sed -n '1,320p' src/pages/Calendar.tsx && sed -n '1,320p' src/pages/Settings.tsx`
Expected: identify any mismatches between older mobile fixes and the new shared shell rules

- [ ] **Step 2: Align calendar and settings with the shell baseline**

Make only the changes required to keep these routes consistent with the updated app shell and acceptance criteria.

- [ ] **Step 3: Verify nested settings pages still behave correctly**

Spot-check the settings subpages for spacing, tabs, and overflow regressions after the shell updates.

- [ ] **Step 4: Verify the consistency sweep**

Run: `npm run build`
Expected: successful build after consistency updates

- [ ] **Step 5: Commit the consistency sweep**

Run:
```bash
git add src/pages/Calendar.tsx src/pages/Settings.tsx src/pages/settings/*.tsx
git commit -m "fix: align calendar and settings responsive patterns" -m "Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

### Task 6: Manual Responsive Verification And Handoff Notes

**Files:**
- Modify: `docs/superpowers/specs/2026-04-02-toabh-mobile-responsive-audit-design.md`
- Modify: `docs/superpowers/plans/2026-04-02-toabh-mobile-responsive-audit.md`

- [ ] **Step 1: Build the app one final time**

Run: `npm run build`
Expected: successful build with no regressions

- [ ] **Step 2: Run manual route verification**

Check `/dashboard`, `/castings`, `/clients`, `/calendar`, `/team`, `/activity`, `/reports`, and `/settings` at representative widths around `390px`, `768px`, and `1024px`.
Expected: no clipped dialogs, no accidental horizontal overflow, and reachable primary actions

- [ ] **Step 3: Record any residual risk in the docs**

If any route still requires follow-up, note it in the design or plan document before handoff.

- [ ] **Step 4: Commit verification notes if docs changed**

Run:
```bash
git add docs/superpowers/specs/2026-04-02-toabh-mobile-responsive-audit-design.md docs/superpowers/plans/2026-04-02-toabh-mobile-responsive-audit.md
git commit -m "docs: finalize mobile audit handoff notes" -m "Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```
