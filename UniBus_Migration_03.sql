-- UniBus-New Migration 03 — based on STUDENT_MODULE_SETUP.sql
-- Requires Migration 01 and 02. Run in UniBus-New SQL Editor.
BEGIN;

CREATE TABLE IF NOT EXISTS public.complaints (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 bus_id uuid REFERENCES public.buses(id) ON DELETE SET NULL,
 category text NOT NULL,
 description text NOT NULL,
 status text NOT NULL DEFAULT 'Pending'
   CHECK (status IN ('Pending','In Progress','Resolved','Rejected')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 title text NOT NULL,
 message text NOT NULL,
 type text NOT NULL DEFAULT 'general',
 is_read boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS complaints_student_created_idx ON public.complaints(student_id,created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications(user_id,created_at DESC);
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can submit complaints" ON public.complaints;
CREATE POLICY "Students can submit complaints" ON public.complaints FOR INSERT TO authenticated
WITH CHECK (student_id = (SELECT auth.uid()) AND EXISTS (
 SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'user'
) AND status = 'Pending');
DROP POLICY IF EXISTS "Students can view own complaints" ON public.complaints;
CREATE POLICY "Students can view own complaints" ON public.complaints FOR SELECT TO authenticated
USING (student_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Admins can manage complaints" ON public.complaints;
CREATE POLICY "Admins can manage complaints" ON public.complaints FOR ALL TO authenticated
USING (public.is_unibus_admin()) WITH CHECK (public.is_unibus_admin());

DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications" ON public.notifications FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Users can mark own notifications read" ON public.notifications;
CREATE POLICY "Users can mark own notifications read" ON public.notifications FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Admins can create notifications" ON public.notifications;
CREATE POLICY "Admins can create notifications" ON public.notifications FOR INSERT TO authenticated
WITH CHECK (public.is_unibus_admin());

-- Restrict regular users to updating only the read flag, not notification content.
REVOKE ALL ON public.complaints, public.notifications FROM anon, authenticated;
GRANT SELECT, INSERT ON public.complaints TO authenticated;
GRANT UPDATE, DELETE ON public.complaints TO authenticated; -- Admin RLS only; students cannot update.
GRANT SELECT, INSERT ON public.notifications TO authenticated;
GRANT UPDATE (is_read) ON public.notifications TO authenticated;

-- Update complaint timestamps on status edits.
CREATE OR REPLACE FUNCTION public.unibus_complaint_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS unibus_complaints_updated_at ON public.complaints;
CREATE TRIGGER unibus_complaints_updated_at BEFORE UPDATE ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.unibus_complaint_touch_updated_at();

-- Idempotent publication setup (avoid 'already member of publication' errors).
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='bus_locations') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.bus_locations;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
 END IF;
END $$;
COMMIT;

SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name IN ('complaints','notifications') ORDER BY table_name;
