-- RLS for prayer_time_settings (see 0002_app_rls.sql for the pattern).
GRANT SELECT, INSERT, UPDATE, DELETE ON app.prayer_time_settings TO tadhkirah_app;
--> statement-breakpoint
ALTER TABLE app.prayer_time_settings ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE app.prayer_time_settings FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY owner_only ON app.prayer_time_settings
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());
