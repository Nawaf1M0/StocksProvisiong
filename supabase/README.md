# Supabase setup for Step 7

1. Create a Supabase project in your account.
2. In the SQL editor, run `001_portfolio_sync.sql` once.
3. Under Authentication, enable the Email provider. Keep the default confirmation/magic-link templates; no template editing is needed.
4. Under Authentication → URL Configuration, add `https://nawaf1m0.github.io/StocksProvisiong/preview/` and `https://nawaf1m0.github.io/StocksProvisiong/` to Redirect URLs. Set Site URL to the preview URL while reviewing. The email link must return to the same environment that requested it. Supabase's built-in mail service can restrict recipients and request frequency; custom SMTP may still be needed for broader email delivery.
5. Under project API settings, copy the Project URL and browser publishable key (or legacy `anon` key). Never use `service_role`, an `sb_secret_` key, or the database password in frontend configuration.

The schema stores live and preview portfolios separately. Row-level security limits each account to its own rows. The save function checks revision numbers atomically and rejects conflicting writes. A connected project is required to test sign-in, account isolation, and database concurrency; this migration has not yet been run or verified against a real database.

The preview integration uses the configured public project URL and publishable key. The live app remains unchanged pending review. Sign-in uses email magic links and persists the session in version-specific browser storage and refreshes it when necessary. Upload and load are explicit actions. Run `node cloud-test.cjs` for mocked client checks. Real email delivery, owner isolation, and database behavior still require verification in the configured project.

## Email and password sign-in

The app supports regular email/password login alongside email links. Existing passwordless users sign in by email link once and open **Set or change password**. New users can create their account through the same email-link option, confirm their email, and set a password. **Forgot password?** sends the standard recovery email back to the current app environment; the verified recovery callback opens the password form. Keep both live and preview URLs on the allowed redirect list. Passwords go directly to Supabase over HTTPS and are never included in local portfolio storage or exports. Passwords remain out of browser storage. Access and refresh tokens are persisted separately for live and preview; reopening verifies the user with Supabase before showing a restored account. Sign-out clears persisted credentials. Web Locks serialize refreshes across tabs when supported.

Implementation follows https://supabase.com/docs/guides/auth/passwords. Current docs were reviewed; the changelog Markdown endpoint was inaccessible in this environment. Password-login and recovery request behavior are covered by mocked tests; actual password changes and email recovery still require a preview test with your account.
