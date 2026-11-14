CREATE TYPE "app"."goal_source" AS ENUM('weekly_review', 'daily_intention', 'manual');--> statement-breakpoint
CREATE TYPE "app"."goal_status" AS ENUM('active', 'done', 'let_go');--> statement-breakpoint
CREATE TABLE "app"."improvement_goals" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"text_ct" "bytea" NOT NULL,
	"source" "app"."goal_source" DEFAULT 'manual' NOT NULL,
	"status" "app"."goal_status" DEFAULT 'active' NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."weekly_reviews" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"improved_ct" "bytea",
	"neglected_ct" "bytea",
	"made_easier_ct" "bytea",
	"change_next_ct" "bytea",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."improvement_goals" ADD CONSTRAINT "improvement_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."weekly_reviews" ADD CONSTRAINT "weekly_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "improvement_goals_user_status_idx" ON "app"."improvement_goals" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_reviews_week_uq" ON "app"."weekly_reviews" USING btree ("user_id","week_start");