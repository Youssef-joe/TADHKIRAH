-- RLS for the M5 reflection tables (pattern: 0002_app_rls.sql). Reflections are the most sensitive data in the product.
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON app.user_keys, app.reflection_questions, app.daily_reflections, app.reflection_answers TO tadhkirah_app;
--> statement-breakpoint
ALTER TABLE app.user_keys ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE app.user_keys FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY owner_only ON app.user_keys USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
ALTER TABLE app.reflection_questions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE app.reflection_questions FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY owner_only ON app.reflection_questions USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
ALTER TABLE app.daily_reflections ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE app.daily_reflections FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY owner_only ON app.daily_reflections USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
ALTER TABLE app.reflection_answers ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE app.reflection_answers FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY owner_only ON app.reflection_answers USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
