# Step 7: optional account and portfolio sync

## User experience

- Continue using the app without an account. Existing browser holdings remain available.
- Offer email sign-in once a cloud backend is configured. Do not show a successful sign-in or sync before a real service confirms it.
- Start with explicit **Upload this portfolio** and **Load cloud portfolio** actions. Confirm a replacement and offer a local backup before loading cloud data.
- Show the last confirmed sync time, unsynced changes, and connection errors.
- Keep preview and live cloud portfolios separate, just as their browser storage is separate.
- Signing out ends account access but keeps the local portfolio. Explain that local copies remain on shared devices.

## Data and conflict behavior

Store one portfolio per account and environment, with holdings, currency, and a server-managed revision. Read and write access must be enforced by the backend for the authenticated owner.

Before an upload, compare the last loaded cloud revision to the current server revision. Write atomically only when they match. If another device has changed the portfolio, stop and let the user choose which version to keep. Never silently merge or overwrite it.

Validate cloud records using the same holding rules as local imports. Accept empty portfolios for account sync. Keep JSON/CSV exports usable independently of account access.

Account-specific revisions and sync metadata must be cleared on sign-out or account change. A failed request must not mark the portfolio as synced or replace local data.

## Service setup

Recommended service: Supabase Auth and PostgreSQL with row-level security. A different existing service can be used if selected before integration.

Required setup includes a service project, email sign-in configuration, database migration, and allowed app/preview origins. Only browser-public configuration belongs in frontend source. Administrative credentials must never be embedded in the app or committed.

No cloud account, database, or connection has been created by this design step. Service choice and project availability are pending. Existing hosting and portfolio data are unchanged.

## Verification before release

Check sign-in and sign-out, owner isolation, preview/live isolation, empty portfolios, upload and download confirmations, offline failure, account switching, and conflicting updates from two devices. Review the working integration on the preview before promoting it to live.
