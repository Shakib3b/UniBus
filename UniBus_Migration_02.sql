-- UniBus-New Migration 02: reconstructed transport schema
-- Run only after Migration 01, in the NEW Supabase project.

create table public.buses (
 id uuid primary key default gen_random_uuid(),
 bus_number text not null unique,
 bus_name text,
 is_active boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.routes (
 id uuid primary key default gen_random_uuid(),
 route_name text not null unique,
 description text,
 route_geometry jsonb,
 is_active boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.stops (
 id uuid primary key default gen_random_uuid(),
 stop_name text not null,
 latitude double precision not null check (latitude between -90 and 90),
 longitude double precision not null check (longitude between -180 and 180),
 created_at timestamptz not null default now()
);
create table public.route_stops (
 id uuid primary key default gen_random_uuid(),
 route_id uuid not null references public.routes(id) on delete cascade,
 stop_id uuid not null references public.stops(id) on delete cascade,
 stop_order integer not null check (stop_order >= 0),
 unique(route_id,stop_order),
 unique(route_id,stop_id)
);
create table public.bus_route_assignments (
 id uuid primary key default gen_random_uuid(),
 bus_id uuid not null references public.buses(id) on delete cascade,
 route_id uuid not null references public.routes(id) on delete cascade,
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(bus_id,route_id)
);
create table public.drivers (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null,
 phone text,
 license_number text,
 bus_id uuid references public.buses(id) on delete set null,
 is_active boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.trip_logs (
 id uuid primary key default gen_random_uuid(),
 bus_id uuid not null references public.buses(id),
 driver_id uuid not null references public.drivers(id),
 route_id uuid not null references public.routes(id),
 status text not null default 'active' check(status in ('active','completed')),
 started_at timestamptz not null default now(),
 ended_at timestamptz,
 check (ended_at is null or ended_at >= started_at)
);
create unique index trip_one_active_per_driver on public.trip_logs(driver_id) where status='active';
create table public.bus_locations (
 bus_id uuid primary key references public.buses(id) on delete cascade,
 driver_id uuid not null references public.drivers(id),
 trip_id uuid references public.trip_logs(id) on delete set null,
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 speed double precision,
 accuracy double precision,
 updated_at timestamptz not null default now()
);
create index route_stops_route_order_idx on public.route_stops(route_id,stop_order);
create index trip_logs_driver_started_idx on public.trip_logs(driver_id,started_at desc);
create index bus_locations_updated_idx on public.bus_locations(updated_at desc);

-- Check the current user's admin role without recursive profiles RLS checks.
create or replace function public.is_unibus_admin()
returns boolean language sql stable security definer
set search_path = ''
as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin');
$$;
revoke all on function public.is_unibus_admin() from public;
grant execute on function public.is_unibus_admin() to authenticated;

-- Restrict writes to the authenticated admin; transport reads to signed-in users.
do $$ declare t text; begin
 foreach t in array array['buses','routes','stops','route_stops','bus_route_assignments','drivers','trip_logs','bus_locations'] loop
  execute format('alter table public.%I enable row level security',t);
 end loop;
end $$;

create policy "Authenticated read buses" on public.buses for select to authenticated using(true);
create policy "Authenticated read routes" on public.routes for select to authenticated using(true);
create policy "Authenticated read stops" on public.stops for select to authenticated using(true);
create policy "Authenticated read route stops" on public.route_stops for select to authenticated using(true);
create policy "Authenticated read assignments" on public.bus_route_assignments for select to authenticated using(true);
create policy "Admin read drivers or self" on public.drivers for select to authenticated using(id=(select auth.uid()) or public.is_unibus_admin());
create policy "Driver read own trips or admin" on public.trip_logs for select to authenticated using(driver_id=(select auth.uid()) or public.is_unibus_admin());
create policy "Authenticated read live locations" on public.bus_locations for select to authenticated using(true);

create policy "Admin manage buses" on public.buses for all to authenticated using(public.is_unibus_admin()) with check(public.is_unibus_admin());
create policy "Admin manage routes" on public.routes for all to authenticated using(public.is_unibus_admin()) with check(public.is_unibus_admin());
create policy "Admin manage stops" on public.stops for all to authenticated using(public.is_unibus_admin()) with check(public.is_unibus_admin());
create policy "Admin manage route stops" on public.route_stops for all to authenticated using(public.is_unibus_admin()) with check(public.is_unibus_admin());
create policy "Admin manage assignments" on public.bus_route_assignments for all to authenticated using(public.is_unibus_admin()) with check(public.is_unibus_admin());
create policy "Admin manage drivers" on public.drivers for all to authenticated using(public.is_unibus_admin()) with check(public.is_unibus_admin());

create policy "Driver start own trip" on public.trip_logs for insert to authenticated
with check(driver_id=(select auth.uid()) and exists(
 select 1 from public.drivers d where d.id=(select auth.uid()) and d.bus_id=trip_logs.bus_id and d.is_active
) and exists(
 select 1 from public.bus_route_assignments a where a.bus_id=trip_logs.bus_id and a.route_id=trip_logs.route_id and a.is_active
) and status='active' and ended_at is null);
create policy "Driver finish own trip" on public.trip_logs for update to authenticated
using(driver_id=(select auth.uid()) and status='active')
with check(driver_id=(select auth.uid()) and status='completed' and ended_at is not null);
create policy "Admin manage trips" on public.trip_logs for all to authenticated using(public.is_unibus_admin()) with check(public.is_unibus_admin());

create policy "Driver insert own location" on public.bus_locations for insert to authenticated
with check(driver_id=(select auth.uid()) and exists(
 select 1 from public.drivers d where d.id=(select auth.uid()) and d.bus_id=bus_locations.bus_id and d.is_active
) and exists(
 select 1 from public.trip_logs t where t.id=bus_locations.trip_id and t.driver_id=(select auth.uid()) and t.bus_id=bus_locations.bus_id and t.status='active'
));
create policy "Driver update own location" on public.bus_locations for update to authenticated
using(driver_id=(select auth.uid()))
with check(driver_id=(select auth.uid()) and exists(
 select 1 from public.drivers d where d.id=(select auth.uid()) and d.bus_id=bus_locations.bus_id and d.is_active
) and exists(
 select 1 from public.trip_logs t where t.id=bus_locations.trip_id and t.driver_id=(select auth.uid()) and t.bus_id=bus_locations.bus_id and t.status='active'
));
create policy "Admin manage locations" on public.bus_locations for all to authenticated using(public.is_unibus_admin()) with check(public.is_unibus_admin());

-- Allow client queries, but RLS policies above still control row access.
grant select,insert,update,delete on public.buses,public.routes,public.stops,public.route_stops,public.bus_route_assignments,public.drivers,public.trip_logs,public.bus_locations to authenticated;

select table_name from information_schema.tables
where table_schema='public' and table_name in
('profiles','buses','routes','stops','route_stops','bus_route_assignments','drivers','trip_logs','bus_locations')
order by table_name;
