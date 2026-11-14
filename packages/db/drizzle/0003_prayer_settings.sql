CREATE TYPE "app"."asr_method" AS ENUM('standard', 'hanafi');--> statement-breakpoint
CREATE TYPE "app"."high_lat_rule" AS ENUM('middle_of_night', 'seventh_of_night', 'twilight_angle');--> statement-breakpoint
CREATE TABLE "app"."prayer_time_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"latitude" numeric(7, 2) NOT NULL,
	"longitude" numeric(7, 2) NOT NULL,
	"location_label" text NOT NULL,
	"country_code" text,
	"method" text NOT NULL,
	"asr_method" "app"."asr_method" DEFAULT 'standard' NOT NULL,
	"high_lat_rule" "app"."high_lat_rule",
	"adjustments" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"jumuah_khutbah_time" time,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prayer_lat_ck" CHECK ("app"."prayer_time_settings"."latitude" between -90 and 90),
	CONSTRAINT "prayer_lng_ck" CHECK ("app"."prayer_time_settings"."longitude" between -180 and 180)
);
--> statement-breakpoint
ALTER TABLE "app"."user_profiles" ADD COLUMN "onboarded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."prayer_time_settings" ADD CONSTRAINT "prayer_time_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;