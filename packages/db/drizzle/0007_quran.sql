CREATE TYPE "app"."memorization_status" AS ENUM('not_started', 'in_progress', 'memorized');--> statement-breakpoint
CREATE TYPE "app"."revision_quality" AS ENUM('smooth', 'some_mistakes', 'needs_work');--> statement-breakpoint
CREATE TABLE "app"."quran_memorization" (
	"user_id" uuid NOT NULL,
	"surah" smallint NOT NULL,
	"status" "app"."memorization_status" DEFAULT 'not_started' NOT NULL,
	"ranges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_revised_on" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quran_memorization_user_id_surah_pk" PRIMARY KEY("user_id","surah"),
	CONSTRAINT "quran_memorization_surah_ck" CHECK ("app"."quran_memorization"."surah" between 1 and 114)
);
--> statement-breakpoint
CREATE TABLE "app"."quran_recitations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"pages" numeric,
	"from_surah" smallint,
	"from_ayah" smallint,
	"to_surah" smallint,
	"to_ayah" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quran_recitations_has_value_ck" CHECK ("app"."quran_recitations"."pages" > 0 or "app"."quran_recitations"."from_surah" is not null),
	CONSTRAINT "quran_recitations_range_ck" CHECK (num_nonnulls("app"."quran_recitations"."from_surah", "app"."quran_recitations"."from_ayah", "app"."quran_recitations"."to_surah", "app"."quran_recitations"."to_ayah") in (0, 4))
);
--> statement-breakpoint
CREATE TABLE "app"."quran_revisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"surah" smallint NOT NULL,
	"from_ayah" smallint NOT NULL,
	"to_ayah" smallint NOT NULL,
	"quality" "app"."revision_quality",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quran_revisions_range_ck" CHECK ("app"."quran_revisions"."from_ayah" <= "app"."quran_revisions"."to_ayah")
);
--> statement-breakpoint
ALTER TABLE "app"."quran_memorization" ADD CONSTRAINT "quran_memorization_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quran_recitations" ADD CONSTRAINT "quran_recitations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quran_revisions" ADD CONSTRAINT "quran_revisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quran_recitations_user_date_idx" ON "app"."quran_recitations" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE INDEX "quran_revisions_user_surah_idx" ON "app"."quran_revisions" USING btree ("user_id","surah","local_date");