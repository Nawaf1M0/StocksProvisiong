# Delayed and closing price setup

The preview uses SAHMK for Saudi delayed quotes and Alpha Vantage's default end-of-day US quote. No subscription has been purchased and no provider secret is in source.

## Provider accounts

1. Create a free developer account at https://www.sahmk.sa/en/developers and generate an API key. The advertised free tier includes 15-minute delayed quotes with up to 100 requests/day, for limited exploration. Review its usage terms for your intended application.
2. Obtain a free Alpha Vantage key at https://www.alphavantage.co/support/#api-key. The default GLOBAL_QUOTE endpoint is end-of-day; no realtime entitlement is requested. Check your account's current request limit.

Do not paste either provider key into chat, app inputs, frontend source, or GitHub. In Supabase → Edge Functions → Secrets, add:

- `SAHMK_API_KEY`
- `ALPHA_VANTAGE_API_KEY`

## Deploy the function

Deploy `supabase/functions/market-quote/index.js` as an Edge Function named `market-quote` in project `szuzcqzxjolqshdvwvss`. The Supabase dashboard can deploy a function through its editor; replace its example with this file. The body independently validates the user's bearer token through Supabase Auth. If the gateway's legacy JWT check rejects valid sessions from the project's signing keys, configure gateway verification appropriately while preserving the function's own authentication checks.

The function's allowed browser origin is `https://nawaf1m0.github.io` (shared by live and preview). It requires a signed-in account, accepts only Saudi four-digit symbols or US ticker characters, and chooses the provider on the server. It never accepts an arbitrary provider URL from a browser.

Quotes are cached for up to 15 minutes per function instance. Refreshes are throttled per account per instance. These are best-effort usage reductions, not distributed quota enforcement; provider account limits still apply. Never assume a cache extends a provider license.

## Review

Sign in on the preview. Open a holding, expand **Use a delayed or closing market price**, choose its market, and fetch. Review the source, feed type, and quote date/time. **Use for buy price** copies the price into the form without saving the holding automatically. Quote currency must match the selected stock: SAR for Saudi and USD for US. A portfolio can contain stocks in multiple currencies. Totals remain grouped by currency; FX-converted combined valuation is not implemented.

Check one Saudi and one US symbol, quota or unavailable-provider errors, currency mismatch, and changing holdings during a request. The current preview is not a verified connected market-data service until both secrets and the function are deployed and these real requests pass.

Sources: https://www.sahmk.sa/en/developers and https://www.alphavantage.co/documentation/ (GLOBAL_QUOTE).
