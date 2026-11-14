-- RLS for the M4 Quran tables (pattern: 0002_app_rls.sql).
GRANT SELECT, INSERT, UPDATE, DELETE ON app.quran_recitations, app.quran_memorization, app.quran_revisions TO tadhkirah_app;
--> statement-breakpoint
ALTER TABLE app.quran_recitations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE app.quran_recitations FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY owner_only ON app.quran_recitations USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
ALTER TABLE app.quran_memorization ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE app.quran_memorization FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY owner_only ON app.quran_memorization USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
ALTER TABLE app.quran_revisions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE app.quran_revisions FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY owner_only ON app.quran_revisions USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
