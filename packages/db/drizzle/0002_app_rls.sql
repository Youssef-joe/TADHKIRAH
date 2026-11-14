-- Row-level security for private user data (Architecture §6, defence in depth).
--
-- The API connects as the database owner (a superuser in the default compose
-- stack), and superusers bypass RLS. So user-scoped transactions switch to the
-- non-login role `tadhkirah_app` with SET LOCAL ROLE, after setting
-- `app.user_id`. See `withUser()` in packages/db/src/index.ts.
--
-- Every new table in the `app` schema MUST enable and force RLS and add a policy.
-- The integration test "every app table has RLS" enforces this.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tadhkirah_app') THEN
    CREATE ROLE tadhkirah_app NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
-- Lets a non-superuser owner (e.g. a standalone Coolify database) switch to the role too.
GRANT tadhkirah_app TO CURRENT_USER;
--> statement-breakpoint
GRANT USAGE ON SCHEMA app TO tadhkirah_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO tadhkirah_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tadhkirah_app;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.current_user_id() TO tadhkirah_app;
--> statement-breakpoint
ALTER TABLE app.user_profiles ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE app.user_profiles FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY owner_only ON app.user_profiles
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
ALTER TABLE app.user_preferences ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE app.user_preferences FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY owner_only ON app.user_preferences
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());
