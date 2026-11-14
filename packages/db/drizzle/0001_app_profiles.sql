CREATE SCHEMA "app";
--> statement-breakpoint
CREATE TYPE "app"."digits" AS ENUM('arab', 'latn');--> statement-breakpoint
CREATE TYPE "app"."locale" AS ENUM('ar', 'en');--> statement-breakpoint
CREATE TYPE "app"."theme" AS ENUM('system', 'light', 'dark');--> statement-breakpoint
CREATE TABLE "auth"."rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "app"."user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"week_start" smallint DEFAULT 6 NOT NULL,
	"hijri_offset" smallint DEFAULT 0 NOT NULL,
	"backfill_days" smallint DEFAULT 7 NOT NULL,
	"theme" "app"."theme" DEFAULT 'system' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_week_start_ck" CHECK ("app"."user_preferences"."week_start" between 0 and 6),
	CONSTRAINT "user_preferences_hijri_offset_ck" CHECK ("app"."user_preferences"."hijri_offset" between -2 and 2),
	CONSTRAINT "user_preferences_backfill_days_ck" CHECK ("app"."user_preferences"."backfill_days" between 0 and 30)
);
--> statement-breakpoint
CREATE TABLE "app"."user_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"locale" "app"."locale" DEFAULT 'ar' NOT NULL,
	"digits" "app"."digits" DEFAULT 'arab' NOT NULL,
	"timezone" text DEFAULT 'Asia/Riyadh' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;