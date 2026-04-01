# TOABH Casting Hub Vercel Deployment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the current TOABH Casting Hub Vite frontend to Vercel and return a working public URL.

**Architecture:** Keep the existing Vite frontend intact, validate the production build locally, configure deployment through the Vercel CLI, and set `VITE_API_URL` in Vercel before shipping. Only add repo files if deployment verification shows they are required.

**Tech Stack:** Vite, React, TypeScript, npm, Vercel CLI

---

## File Structure

- `package.json`
  Responsibility: source of build scripts and dependency metadata; modify only if deployment verification proves a missing script or package declaration.
- `package-lock.json`
  Responsibility: lockfile for any approved dependency changes.
- `vercel.json`
  Responsibility: optional Vercel project configuration if routing/build output cannot be handled by defaults.
- `.env.example`
  Responsibility: optional developer-facing documentation for required frontend environment variables if the deploy task needs this documented in-repo.
- `README.md`
  Responsibility: optional deployment notes if the final implementation introduces repeatable deployment setup that should be captured.

### Task 1: Verify the local deployment baseline

**Files:**
- Modify: `package.json` only if a missing build script blocks deployment verification
- Modify: `package-lock.json` only if dependency installation updates the lockfile

- [ ] **Step 1: Install project dependencies**

Run: `npm install`
Expected: install completes without fatal errors and creates `node_modules`

- [ ] **Step 2: Verify the production build**

Run: `npm run build`
Expected: Vite build completes successfully and outputs production assets

- [ ] **Step 3: Inspect environment-variable usage**

Check: `src/lib/api.ts` and other `import.meta.env` call sites
Expected: confirm whether `VITE_API_URL` can be left empty for same-origin `/api` traffic or must be set to an external backend origin

- [ ] **Step 4: Record the result in the issue thread**

Comment on the parent issue with:
- whether the build passed
- whether `VITE_API_URL` must be set
- whether any repo changes are required before deploy

- [ ] **Step 5: Commit only if repo files changed**

```bash
git add package.json package-lock.json
git commit -m "chore: prepare deployment baseline

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

### Task 2: Install and authenticate the Vercel deployment toolchain

**Files:**
- Create: `vercel.json` only if Vercel defaults are insufficient

- [ ] **Step 1: Install the Vercel CLI**

Run: `npm install -g vercel`
Expected: `vercel --version` returns a version string

- [ ] **Step 2: Authenticate the CLI**

Run: `vercel login`
Expected: the CLI session is authenticated for the target Vercel account

- [ ] **Step 3: Link or create the Vercel project**

Run: `vercel link` or `vercel`
Expected: a Vercel project is created or linked to this workspace

- [ ] **Step 4: Add `vercel.json` only if the default project detection fails**

Create `vercel.json` with only the minimal required settings, for example:

```json
{
  "framework": "vite"
}
```

Expected: project setup succeeds without introducing unnecessary config

- [ ] **Step 5: Commit only if `vercel.json` was added**

```bash
git add vercel.json
git commit -m "chore: add minimal vercel config

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

### Task 3: Configure runtime environment and deploy

**Files:**
- Create: `.env.example` only if deployment reveals undocumented required env vars
- Modify: `README.md` only if repeatable deployment instructions should be captured

- [ ] **Step 1: Set the production environment variable in Vercel**

Run one of:
- `vercel env add VITE_API_URL production`
- `vercel env add VITE_API_URL preview`

Expected: the correct backend origin is stored in Vercel for the target environment

- [ ] **Step 2: Trigger the deployment**

Run: `vercel --prod`
Expected: Vercel returns a production deployment URL

- [ ] **Step 3: Smoke-test the deployed app**

Check:
- the homepage loads
- core dashboard routes render
- API-backed pages do not immediately fail due to missing `VITE_API_URL`

Expected: the live app is usable enough to share with the requester

- [ ] **Step 4: Document any new required env vars if needed**

If missing documentation becomes a deployment risk, create `.env.example` with:

```bash
VITE_API_URL=
```

Expected: future deployers can see the required frontend env surface

- [ ] **Step 5: Update the requester with the final link**

Comment on the issue with:
- deployed Vercel URL
- whether it is preview or production
- any unresolved backend caveats

- [ ] **Step 6: Commit only if repo documentation changed**

```bash
git add .env.example README.md
git commit -m "docs: document deployment environment requirements

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```
