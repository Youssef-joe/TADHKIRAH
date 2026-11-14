-- RLS for the M3 worship tables (pattern: 0002_app_rls.sql). Default privileges already grant DML to tadhkirah_app.
GRANT SELECT, INSERT, UPDATE, DELETE ON app.user_activities, app.worship_logs, app.day_flags TO tadhkirah_app;
--> statement-breakpoint
ALTER TABLE app.user_activities ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE app.user_activities FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY owner_only ON app.user_activities USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
ALTER TABLE app.worship_logs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE app.worship_logs FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY owner_only ON app.worship_logs USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
ALTER TABLE app.day_flags ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE app.day_flags FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY owner_only ON app.day_flags USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
