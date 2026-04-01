# TOABH Casting Hub Vercel Deployment Design

## Summary

Deploy the existing TOABH Casting Hub frontend to Vercel by using the current Vite production build, configuring the required runtime environment variables in Vercel, and returning a working public URL to the requester.

## Chosen Direction

Use a direct Vercel CLI deployment flow against the existing repository instead of adding CI/CD automation first.

This is the fastest path to a working hosted dashboard because:

- the repo is already a Vite app with a standard `npm run build`
- the requester explicitly asked for Vercel CLI installation and deployment
- there is no requirement yet for branch-based preview automation or repeatable release workflows

## Tradeoffs

### Recommended: direct CLI deployment

- Fastest path to a live URL
- Minimal repo changes if the existing Vite output works as-is
- Accepts some manual release overhead until deployment is stable

### Alternative: add deployment config and CI now

- Better repeatability for future releases
- Higher upfront effort
- Not justified until the first successful deployment proves the target shape

## Architecture

The deployed artifact remains a static Vite frontend hosted by Vercel. The frontend continues to use `VITE_API_URL` for API calls. If no explicit backend origin is provided, the deployment should prefer same-origin `/api` behavior only if that is already supported by the runtime backend path. Otherwise the deployment must set the real external API base URL in Vercel before release.

## Scope

### In scope

- install local dependencies needed to verify the build
- install the Vercel CLI locally
- verify the production build succeeds
- create or link a Vercel project
- configure required environment variables in Vercel
- deploy and validate the hosted app
- return the deployment link

### Out of scope

- redesigning dashboard UI
- adding a full CI/CD pipeline
- backend changes unrelated to making the current frontend deployable

## Risks

1. The frontend expects `VITE_API_URL`, but the real backend origin is not documented in the repo.
2. The workspace currently lacks installed dependencies and the Vercel CLI.
3. If same-origin `/api` is not actually available in production, the app can deploy successfully but fail at runtime until the API origin is configured.

## Success Criteria

1. `npm run build` succeeds locally.
2. A Vercel project exists for this repo.
3. Required environment variables are configured in Vercel.
4. The deployed app loads from a public Vercel URL.
5. The requester receives the deployment link and any environment caveats.
