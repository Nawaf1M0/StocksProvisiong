# Step 8: Saudi and US price updates

## Confirmed scope

Support Saudi Exchange and US stocks. Keep manual prices usable. A fetched quote shows its source, currency, quote timestamp, and whether it is end-of-day, delayed, or real-time. It never changes saved holdings automatically: the user explicitly copies it to the proposed buy price, reviews the calculation, and saves the holding.

Each stock has its own currency. Saudi SAR and US USD quotes must match the selected stock. Totals are grouped by currency; combined FX-converted valuation is a separate feature.

## Connection design

Keep the provider key in a Supabase Edge Function secret, not frontend code, local storage, or GitHub. Validate the signed-in user before provider requests. The server validates symbol and market, caches quotes, and limits refreshes. Provider failures retain the entered buy price. Reject mismatched symbols, currency, invalid prices, missing timestamps, and unlabelled feed types.

`dist/quotes.js` defines the provider-neutral request and response checks. The preview includes explicit fetch and apply controls backed by a Supabase Edge Function; requests cannot succeed until its deployment and provider secrets are configured.

## Delayed-data implementation

The selected initial adapters are SAHMK delayed Saudi quotes and Alpha Vantage default end-of-day US quotes. See `docs/market-data-setup.md` for provider accounts, server secrets, and function deployment. Browser request and response validation and mocked server tests are implemented. No paid subscription has been purchased. Actual provider keys, Edge Function deployment, and real market-data verification are pending; connected Supabase tooling denied project access.
