# Position — Stock Averaging Planner

A lightweight portfolio tracker and averaging-down calculator. Enter your holdings and a desired average cost to see the additional shares and cash required, compare purchases, and understand how your exposure changes.

**[Open the live app](https://nawaf1m0.github.io/StocksProvisiong/)** · **[Review the preview](https://nawaf1m0.github.io/StocksProvisiong/preview/)** · **[Deployment status](https://github.com/Nawaf1M0/StocksProvisiong/actions)**

## Features

- Multiple holdings, each with its own currency, shares owned, average cost, proposed buy price, and target average.
- Required purchase size and cash, including a flat purchase fee and optional fractional shares.
- Fixed-budget estimates and up to three side-by-side purchase scenarios.
- Before/after averages, break-even recovery percentages, position value, portfolio concentration, and unrealized gain or loss.
- Mobile section shortcuts, touch-friendly inputs, and a persistent purchase summary.
- Browser-local storage, JSON/CSV backups, backup reminders, validated imports, and deletion confirmation.
- Optional Supabase email/password or email-link sign-in, password setup and recovery, and automatic account-linked portfolio storage.
- Saudi delayed reference quotes through SAHMK and US end-of-day quotes through Alpha Vantage, with source and quote date/time shown.

## Getting started

Use the hosted app, or open `dist/index.html` locally for the calculator. The static app needs no dependency installation or build step. Hosted HTTPS is required for the supported email-link authentication flow; cloud sync and market data also require configured services and an internet connection.

1. Add or select a stock and choose its currency in the holding form.
2. Select **Add stock**, then enter its symbol, shares owned, average purchase price, new buy price, target average, and optional fee.
3. Review the shares and cash needed, the budget alternative, and position exposure.
4. Select **Save holding** to keep the planning values in this browser.
5. Add comparison scenarios to explore other prices, targets, and budgets. **Use in purchase planner** copies a scenario into the form for review.

Saving a plan does not execute a trade or add proposed shares to your actual holdings. Update the shares and average cost yourself after a completed purchase. Scenarios are temporary and reset when you change holdings.

## Calculation assumptions

For existing shares `q`, average cost `a`, buy price `p`, target average `t`, and a flat new-purchase fee `f`:

```text
Additional shares = (q × (a − t) + f) / (t − p)
Cash required     = additional shares × p + f
Resulting average = (q × a + cash required) / (q + additional shares)
```

A lower target is reachable only when the new buy price is below that target. Whole-share mode rounds the required shares upward; fractional mode uses the calculated amount. Your existing average is assumed to include prior costs. Selling fees and taxes are excluded from break-even estimates.

For example, 100 shares averaging 150 require another 100 shares at 100 to reach an average of 125, before fees. The existing monetary loss at a price of 100 remains 5,000, while the invested amount increases.

**Currency belongs to each stock.** Hold USD, SAR, EUR, GBP, and AED stocks in the same account. Invested cost, entered-price value, and unrealized gain/loss are grouped by currency; amounts in different currencies are never added together without conversion. Concentration compares only holdings in the selected stock’s currency and excludes cash and untracked assets. Changing an existing holding’s currency requires confirmation and does not convert any amounts. Temporary scenarios reset when the stock currency changes.

Existing holdings without their own currency inherit their original saved portfolio currency when loaded, preserving amounts and account ownership. The old envelope currency field remains only as a backward-compatible migration default; it no longer determines the currency of stocks that have their own setting.

## Accounts and cloud sync

An account is optional. Without signing in, holdings remain in browser local storage.

- Use email/password sign-in, or request an email sign-in link.
- If you have no password, sign in by email link first and open **Set or change password**. **Forgot password?** starts email recovery.
- Signing in automatically loads your portfolio from Supabase. Saved holdings, imports, deletions, and saved stock-currency changes automatically sync to your account; unsaved form edits are excluded.
- Each user has a separate browser cache. Offline or failed saves remain pending and retry when the connection returns. The account status message distinguishes local changes from a confirmed cloud save.
- **Retry account sync** retries pending changes. **Reload cloud copy** explicitly replaces pending local changes after confirmation and preserves a local recovery copy. Export a backup first if needed.
- Original local-only data remains under its existing guest key. Use **Import previous device holdings** while signed in to add it to the chosen account after confirmation; it is never silently assigned to whichever user signs in.
- Conflicting saves from another device are rejected using cloud revision checks; no silent merge is performed.
- Sessions are saved in this browser and restored when you reopen the app. Expiring tokens refresh automatically when the app resumes or makes a cloud request. Signing out removes the saved session and signs out other open tabs of the same version. Account holdings remain in Supabase and their separate local cache; the signed-out interface displays guest holdings only. Live and preview sessions are separate. Browser storage restrictions, cleared site data, or revoked sessions may require signing in again. Sign out on shared devices.

Publishing frontend updates does not reset the Supabase database or account cache keys. Live and preview use separate browser storage keys and separate cloud portfolios. They share the same account credentials, but preview holdings do not transfer into live automatically.

For a separate installation, follow [Supabase setup](supabase/README.md) and configure your own public project URL and publishable key in `dist/cloud.js`. Never put an administrative, service-role, or secret key in browser source.

## Delayed and end-of-day prices

In the planner, expand **Use a delayed or closing market price**, choose the market, and select **Fetch reference price**. Sign-in is required.

| Market | Provider | Feed | Stock currency |
| --- | --- | --- | --- |
| Saudi stocks, such as `2222` | SAHMK | Delayed quotes | SAR |
| US stocks, such as `AAPL` | Alpha Vantage | End-of-day quotes | USD |

Fetched quotes do not overwrite the buy price automatically. Review the source and timestamp, then select **Use for buy price** to copy it into the plan. Save the holding separately if you want to retain that price. Quotes are references, not guaranteed execution prices, and the displayed date may be from the last trading session.

Provider coverage and account quotas apply. The server caches quotes for up to 15 minutes per instance; this can add to provider delay. Failed requests retain the entered price. Manual price entry remains available.

Deployment requires the `market-quote` Supabase Edge Function and private `SAHMK_API_KEY` and `ALPHA_VANTAGE_API_KEY` secrets. See [market-data setup](docs/market-data-setup.md). The browser never receives the provider keys.

## Backups and imports

Use **Export JSON** or **Export CSV** to preserve or transfer holdings. A backup reminder records when a file was generated; check that your browser actually saved it.

Imports validate the entire file before asking to add its holdings. Existing entries are kept, duplicate symbols generate a warning, and mixed-currency files are supported. Each CSV row retains its currency; older JSON backups inherit their original currency only for holdings that lack a stock-level setting. Import limits are 1 MB per file and 1,000 total holdings.

CSV uses these columns:

```csv
symbol,shares,average,price,target,fee,budget,fractional,currency
AAPL,10,150,120,135,0,1000,false,USD
```

Use plain decimal numbers without thousands separators and `true` or `false` for fractional shares. Exports escape formula-like symbols as spreadsheet text and restore them on import.

## Development and verification

The frontend is buildless HTML, CSS, and JavaScript in `dist/`. Supabase provides authentication, owner-isolated portfolio storage, and the quote proxy.

With Node.js 22 or later, install the development-only test dependency and run:

```bash
npm ci --ignore-scripts
node scenarios-test.cjs
node test.cjs
node data-test.cjs
node cloud-test.cjs
node auth-session-test.cjs
node account-store-test.cjs
node account-ui-test.cjs
node multicurrency-test.cjs
node quotes-test.cjs
node quotes-edge-test.cjs
```

Scenario regression tests use jsdom to load the real HTML, calculator, planner, and scenario scripts, dispatch input/click events, and check displayed results and saved-holding preservation. They do not call authentication or market-data services. The other tests check calculation edge cases, imports, mocked authentication and sync requests, quote validation, and mocked quote-server behavior. They do not replace browser testing or real provider/account verification. The deployment workflow also checks JavaScript syntax.

## Preview and live releases

GitHub Pages is configured with **Source: GitHub Actions**. The `github-pages` environment must allow the `work` branch to deploy.

1. Push app, script, test, dependency, or workflow changes to `work`. Pull requests into `work` run checks without publishing.
2. **Check and publish app** runs its checks and updates `/preview/`, preserving the live root.
3. Review the preview before approving a live release.
4. In [the deployment workflow](https://github.com/Nawaf1M0/StocksProvisiong/actions/workflows/deploy.yml), select **Run workflow**, branch **work**, target **live**, and confirmation **PUBLISH**.
5. Wait for checks, build, and deploy to succeed, then refresh the live app.

The release assembler preserves the other version's files and versions asset URLs to avoid stale scripts. Assembled releases are retained on `gh-pages`. Documentation-only changes do not automatically trigger the app deployment workflow.

## Project files

| Path | Purpose |
| --- | --- |
| `dist/` | Static frontend and client-side calculations |
| `supabase/001_portfolio_sync.sql` | Portfolio table, ownership policies, and revision-checked save function |
| `supabase/functions/market-quote/index.js` | Authenticated market-data proxy |
| `scripts/build-release.py` | Assemble preview/live hosting files while preserving the other version |
| `.github/workflows/deploy.yml` | Checks and GitHub Pages deployment |
| `docs/` | Setup and implementation notes |

This app is a planning calculator. Averaging down increases the money exposed to a stock; a lower average cost does not remove an existing loss or guarantee a recovery.
