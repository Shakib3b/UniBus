# UniBus student module update

Included: admin-created student accounts, student dashboard, active bus listing, Leaflet live GPS map, student geolocation, OSRM road distance/ETA, route and stop display, in-app notification feed, complaint submission/history, and SQL migration.

## Setup
1. Keep `SUPABASE_SERVICE_ROLE_KEY` configured in Netlify environment variables. Never expose it in browser code.
2. Deploy `netlify/functions/create-student.js`.
3. Run `STUDENT_MODULE_SETUP.sql` in Supabase SQL Editor. If publication says a table is already included, remove/skip that ALTER PUBLICATION line and rerun remaining SQL.
4. Ensure `bus_locations` and `notifications` are enabled in Supabase Realtime publication.
5. In Admin Panel, create a student using full name, login ID and password. Login uses `loginid@busportal.app` internally and profile role `user`.

## Important limitations
- The student module uses the existing tables and column names already present in the uploaded driver/admin source. Confirm bus_locations Realtime is enabled.
- Complaint creation and student complaint history are included. Admin complaint review/reply UI is not yet included.
- Notification history is in-app. Browser permission can be requested, but remote push while the site is closed is NOT configured: it requires Firebase/VAPID credentials, service worker, subscription storage and a server-side push sender.
- OSRM public routing can be rate-limited; use a hosted routing service for production scale.
