# UniBus-New deployment instructions

## Status
Frontend URL updated to `https://wbrjuowfjophuucosbmy.supabase.co`. The **new publishable key was not provided**, so the browser scripts intentionally contain `REPLACE_WITH_NEW_SUPABASE_PUBLISHABLE_KEY`. The app cannot authenticate until replaced.

## Required configuration
1. Supabase dashboard > Settings > API Keys: copy **new project publishable key** (`sb_publishable_...`). Replace `REPLACE_WITH_NEW_SUPABASE_PUBLISHABLE_KEY` in `app.js`, `auth-guard.js`, `driver/driver.js` (all three). Do not use the old project's key.
2. Netlify > Site configuration > Environment variables: set `SUPABASE_URL` to `https://wbrjuowfjophuucosbmy.supabase.co`; set `SUPABASE_SERVICE_ROLE_KEY` to the **new project's** secret/service-role key. Mark secret and scope to functions. Never put this key in browser scripts or Git. Redeploy after changes.
3. Migrations 01-04 were reported completed by the user in the new project. SQL copies for 02 and 03 are included for reference only; **do not rerun CREATE TABLE statements**.
4. The administrator Auth account and profiles row must exist in the new project. Test `admin` login with the password chosen in Supabase Auth.
5. Deploy from this directory via Netlify with `npm install` (or `npm ci`) to install function dependencies.
6. Verify admin/driver/student login, driver/student account creation, RLS policies, routes, GPS and Realtime on test accounts before production. Check browser console and Netlify function logs for errors.

## Cautions
- This is a **configuration migration**, not a complete verified application repair. No live Supabase credentials or deployed instance were available for end-to-end tests.
- The existing ZIP has no old database records; do not delete the original project or backup.
- New Supabase Auth users are separate from the old project.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` or any `sb_secret_` key publicly.
