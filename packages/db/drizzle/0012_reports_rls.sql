-- RLS for the M7 weekly review and goals tables (pattern: 0002_app_rls.sql).
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON app.weekly_reviews, app.improvement_goals TO tadhkirah_app;
--> statement-breakpoint
ALTER TABLE app.weekly_reviews ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE app.weekly_reviews FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY owner_only ON app.weekly_reviews USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
ALTER TABLE app.improvement_goals ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE app.improvement_goals FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY owner_only ON app.improvement_goals USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
