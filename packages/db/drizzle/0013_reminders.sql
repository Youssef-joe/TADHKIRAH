CREATE TYPE "app"."reminder_category" AS ENUM('prayer', 'adhkar_morning', 'adhkar_evening', 'quran', 'reflection', 'weekly_review', 'custom');--> statement-breakpoint
CREATE TYPE "app"."reminder_source" AS ENUM('planned', 'snooze');--> statement-breakpoint
CREATE TYPE "app"."reminder_status" AS ENUM('pending', 'sending', 'sent', 'failed', 'expired', 'suppressed', 'cancelled');--> statement-breakpoint
CREATE TABLE "app"."notification_log" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"scheduled_id" uuid,
	"rule_id" uuid,
	"category" "app"."reminder_category" NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pushed" smallint DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opened_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app"."notification_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"quiet_start" time,
	"quiet_end" time,
	"daily_cap" smallint DEFAULT 6 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."push_devices" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_success_at" timestamp with time zone,
	"disabled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app"."reminder_rules" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" "app"."reminder_category" NOT NULL,
	"timing" jsonb NOT NULL,
	"days" smallint[],
	"enabled" boolean DEFAULT false NOT NULL,
	"allow_in_quiet_hours" boolean DEFAULT false NOT NULL,
	"custom_title_ct" "bytea",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."scheduled_reminders" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"rule_id" uuid NOT NULL,
	"fire_at" timestamp with time zone NOT NULL,
	"source" "app"."reminder_source" DEFAULT 'planned' NOT NULL,
	"status" "app"."reminder_status" DEFAULT 'pending' NOT NULL,
	"suppress_reason" text,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."notification_log" ADD CONSTRAINT "notification_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."notification_log" ADD CONSTRAINT "notification_log_scheduled_id_scheduled_reminders_id_fk" FOREIGN KEY ("scheduled_id") REFERENCES "app"."scheduled_reminders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."notification_log" ADD CONSTRAINT "notification_log_rule_id_reminder_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "app"."reminder_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."push_devices" ADD CONSTRAINT "push_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."reminder_rules" ADD CONSTRAINT "reminder_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."scheduled_reminders" ADD CONSTRAINT "scheduled_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."scheduled_reminders" ADD CONSTRAINT "scheduled_reminders_rule_id_reminder_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "app"."reminder_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_log_scheduled_uq" ON "app"."notification_log" USING btree ("scheduled_id");--> statement-breakpoint
CREATE INDEX "notification_log_user_idx" ON "app"."notification_log" USING btree ("user_id","sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "push_devices_endpoint_uq" ON "app"."push_devices" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "reminder_rules_user_idx" ON "app"."reminder_rules" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scheduled_reminders_uq" ON "app"."scheduled_reminders" USING btree ("user_id","rule_id","fire_at");--> statement-breakpoint
CREATE INDEX "scheduled_reminders_due_idx" ON "app"."scheduled_reminders" USING btree ("fire_at") WHERE "app"."scheduled_reminders"."status" = 'pending';