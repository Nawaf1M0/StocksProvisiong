# Supabase setup for Step 7

1. Create a Supabase project in your account.
2. In the SQL editor, run `001_portfolio_sync.sql` once.
3. Under Authentication, enable the Email provider. For email-code sign-in, configure the email template to include the OTP token (`{{ .Token }}`). Check the project's email delivery limits; production email delivery may require your own SMTP service.
4. Under project API settings, copy the Project URL and browser publishable key (or legacy `anon` key). Never use `service_role`, an `sb_secret_` key, or the database password in frontend configuration.

The schema stores live and preview portfolios separately. Row-level security limits each account to its own rows. The save function checks revision numbers atomically and rejects conflicting writes. A connected project is required to test sign-in, account isolation, and database concurrency; this migration has not yet been run or verified against a real database.

Browser integration is pending the project's public connection settings. No placeholder sign-in is enabled in the live app or preview.
