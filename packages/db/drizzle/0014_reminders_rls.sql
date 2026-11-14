-- RLS for the M6 reminder tables (pattern: 0002_app_rls.sql).
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON app.notification_preferences, app.push_devices, app.reminder_rules, app.scheduled_reminders, app.notification_log TO tadhkirah_app;
--> statement-breakpoint
ALTER TABLE app.notification_preferences ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE app.notification_preferences FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY owner_only ON app.notification_preferences USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
ALTER TABLE app.push_devices ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE app.push_devices FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY owner_only ON app.push_devices USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
ALTER TABLE app.reminder_rules ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE app.reminder_rules FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY owner_only ON app.reminder_rules USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
ALTER TABLE app.scheduled_reminders ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE app.scheduled_reminders FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY owner_only ON app.scheduled_reminders USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
ALTER TABLE app.notification_log ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE app.notification_log FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY owner_only ON app.notification_log USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
-- Background jobs (planner and dispatcher) work across users. They run as the
-- table owner (never as tadhkirah_app) and explicitly set app.system = 'on' for
-- their transaction (withSystem() in packages/db). This policy is limited to the
-- tables those jobs need. Reflections and other private content are NOT included.
CREATE OR REPLACE FUNCTION app.is_system_job() RETURNS boolean
  LANGUAGE sql STABLE
  AS $$ SELECT current_setting('app.system', true) = 'on' AND current_user <> 'tadhkirah_app' $$
--> statement-breakpoint
CREATE POLICY system_jobs ON app.notification_preferences USING (app.is_system_job()) WITH CHECK (app.is_system_job());
--> statement-breakpoint
CREATE POLICY system_jobs ON app.push_devices USING (app.is_system_job()) WITH CHECK (app.is_system_job());
--> statement-breakpoint
CREATE POLICY system_jobs ON app.reminder_rules USING (app.is_system_job()) WITH CHECK (app.is_system_job());
--> statement-breakpoint
CREATE POLICY system_jobs ON app.scheduled_reminders USING (app.is_system_job()) WITH CHECK (app.is_system_job());
--> statement-breakpoint
CREATE POLICY system_jobs ON app.notification_log USING (app.is_system_job()) WITH CHECK (app.is_system_job());
--> statement-breakpoint
CREATE POLICY system_jobs ON app.user_profiles USING (app.is_system_job()) WITH CHECK (app.is_system_job());
--> statement-breakpoint
CREATE POLICY system_jobs ON app.prayer_time_settings USING (app.is_system_job()) WITH CHECK (app.is_system_job());
--> statement-breakpoint
CREATE POLICY system_jobs ON app.user_preferences USING (app.is_system_job()) WITH CHECK (app.is_system_job());
