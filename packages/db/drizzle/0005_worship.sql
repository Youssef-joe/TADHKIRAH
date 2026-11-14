CREATE TYPE "app"."measure" AS ENUM('prayer_status', 'boolean', 'count');--> statement-breakpoint
CREATE TYPE "app"."obligation" AS ENUM('obligatory', 'voluntary');--> statement-breakpoint
CREATE TYPE "app"."prayer_status" AS ENUM('on_time', 'later', 'qada', 'excused');--> statement-breakpoint
CREATE TABLE "app"."day_flags" (
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"excused" boolean DEFAULT false NOT NULL,
	"travelling" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "day_flags_user_id_local_date_pk" PRIMARY KEY("user_id","local_date")
);
--> statement-breakpoint
CREATE TABLE "app"."user_activities" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"catalog_key" text,
	"name" text,
	"category" text NOT NULL,
	"obligation" "app"."obligation" NOT NULL,
	"measure" "app"."measure" NOT NULL,
	"unit" text,
	"schedule" jsonb NOT NULL,
	"daily_target" numeric,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_activities_custom_ck" CHECK ("app"."user_activities"."catalog_key" is not null or ("app"."user_activities"."obligation" = 'voluntary' and "app"."user_activities"."name" is not null)),
	CONSTRAINT "user_activities_target_ck" CHECK ("app"."user_activities"."daily_target" is null or "app"."user_activities"."obligation" = 'voluntary')
);
--> statement-breakpoint
CREATE TABLE "app"."worship_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"activity_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"prayer_status" "app"."prayer_status",
	"done" boolean,
	"amount" numeric,
	"client_updated_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "worship_logs_one_value_ck" CHECK (num_nonnulls("app"."worship_logs"."prayer_status", "app"."worship_logs"."done", "app"."worship_logs"."amount") = 1),
	CONSTRAINT "worship_logs_amount_ck" CHECK ("app"."worship_logs"."amount" is null or "app"."worship_logs"."amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "app"."day_flags" ADD CONSTRAINT "day_flags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_activities" ADD CONSTRAINT "user_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."worship_logs" ADD CONSTRAINT "worship_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."worship_logs" ADD CONSTRAINT "worship_logs_activity_id_user_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "app"."user_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_activities_catalog_uq" ON "app"."user_activities" USING btree ("user_id","catalog_key") WHERE "app"."user_activities"."catalog_key" is not null;--> statement-breakpoint
CREATE INDEX "user_activities_user_idx" ON "app"."user_activities" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "worship_logs_day_uq" ON "app"."worship_logs" USING btree ("user_id","activity_id","local_date");--> statement-breakpoint
CREATE INDEX "worship_logs_user_date_idx" ON "app"."worship_logs" USING btree ("user_id","local_date");