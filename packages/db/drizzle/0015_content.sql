CREATE SCHEMA "content";
--> statement-breakpoint
CREATE TYPE "content"."classification" AS ENUM('established', 'less_commonly_practiced');--> statement-breakpoint
CREATE TYPE "content"."status" AS ENUM('draft', 'awaiting_verification', 'verified', 'approved', 'rejected', 'archived');--> statement-breakpoint
CREATE TYPE "content"."difference_kind" AS ENUM('authentication', 'interpretation', 'timing');--> statement-breakpoint
CREATE TYPE "auth"."editorial_role" AS ENUM('admin', 'editor', 'reviewer', 'publisher');--> statement-breakpoint
CREATE TYPE "content"."evidence_type" AS ENUM('explicit_text', 'scholarly_interpretation');--> statement-breakpoint
CREATE TYPE "content"."grade" AS ENUM('sahih', 'hasan', 'sahih_li_ghayrihi', 'hasan_li_ghayrihi', 'daif', 'mawdu');--> statement-breakpoint
CREATE TYPE "content"."subject_type" AS ENUM('hadith', 'sunnah', 'occasion');--> statement-breakpoint
CREATE TABLE "content"."hadith_authentications" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"hadith_id" uuid NOT NULL,
	"grade" "content"."grade" NOT NULL,
	"scholar" text NOT NULL,
	"work_cited" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."hadith_sources" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"key" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"numbering_scheme" text NOT NULL,
	"base_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hadith_sources_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "content"."hadiths" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"source_id" uuid NOT NULL,
	"number" text NOT NULL,
	"book_chapter" text,
	"narrator_id" uuid,
	"text_ar" text,
	"is_excerpt" boolean DEFAULT false NOT NULL,
	"translation_en" text,
	"translation_by" text,
	"source_url" text,
	"editor_notes" text,
	"status" "content"."status" DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"supersedes_id" uuid,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."issue_reports" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"subject_type" "content"."subject_type" NOT NULL,
	"subject_id" uuid NOT NULL,
	"message" text NOT NULL,
	"reported_by" uuid,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."narrators" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."occasion_hadiths" (
	"occasion_id" uuid NOT NULL,
	"hadith_id" uuid NOT NULL,
	"relevance" text,
	CONSTRAINT "occasion_hadiths_occasion_id_hadith_id_pk" PRIMARY KEY("occasion_id","hadith_id")
);
--> statement-breakpoint
CREATE TABLE "content"."review_records" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"subject_type" "content"."subject_type" NOT NULL,
	"subject_id" uuid NOT NULL,
	"subject_revision" integer NOT NULL,
	"action" text NOT NULL,
	"from_status" "content"."status" NOT NULL,
	"to_status" "content"."status" NOT NULL,
	"actor_user_id" uuid,
	"actor_role" text NOT NULL,
	"single_reviewer" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."role_audit" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "auth"."editorial_role" NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."scholarly_differences" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"subject_type" "content"."subject_type" NOT NULL,
	"subject_id" uuid NOT NULL,
	"kind" "content"."difference_kind" NOT NULL,
	"summary_ar" text NOT NULL,
	"summary_en" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."sunnah_hadiths" (
	"sunnah_id" uuid NOT NULL,
	"hadith_id" uuid NOT NULL,
	"relevance" text,
	CONSTRAINT "sunnah_hadiths_sunnah_id_hadith_id_pk" PRIMARY KEY("sunnah_id","hadith_id")
);
--> statement-breakpoint
CREATE TABLE "content"."sunnahs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"slug" text NOT NULL,
	"title_ar" text NOT NULL,
	"title_en" text NOT NULL,
	"description_ar" text DEFAULT '' NOT NULL,
	"description_en" text DEFAULT '' NOT NULL,
	"instructions_ar" text,
	"instructions_en" text,
	"classification" "content"."classification" DEFAULT 'established' NOT NULL,
	"trigger" text DEFAULT 'daily' NOT NULL,
	"status" "content"."status" DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"supersedes_id" uuid,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."supplication_occasions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"slug" text NOT NULL,
	"title_ar" text NOT NULL,
	"title_en" text NOT NULL,
	"explanation_ar" text DEFAULT '' NOT NULL,
	"explanation_en" text DEFAULT '' NOT NULL,
	"window" text NOT NULL,
	"evidence_type" "content"."evidence_type" DEFAULT 'explicit_text' NOT NULL,
	"schedulable" boolean DEFAULT true NOT NULL,
	"status" "content"."status" DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"supersedes_id" uuid,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."user_roles" (
	"user_id" uuid NOT NULL,
	"role" "auth"."editorial_role" NOT NULL,
	"granted_by" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
ALTER TABLE "content"."hadith_authentications" ADD CONSTRAINT "hadith_authentications_hadith_id_hadiths_id_fk" FOREIGN KEY ("hadith_id") REFERENCES "content"."hadiths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."hadith_authentications" ADD CONSTRAINT "hadith_authentications_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."hadiths" ADD CONSTRAINT "hadiths_source_id_hadith_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "content"."hadith_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."hadiths" ADD CONSTRAINT "hadiths_narrator_id_narrators_id_fk" FOREIGN KEY ("narrator_id") REFERENCES "content"."narrators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."hadiths" ADD CONSTRAINT "hadiths_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."hadiths" ADD CONSTRAINT "hadiths_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."issue_reports" ADD CONSTRAINT "issue_reports_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."issue_reports" ADD CONSTRAINT "issue_reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."occasion_hadiths" ADD CONSTRAINT "occasion_hadiths_occasion_id_supplication_occasions_id_fk" FOREIGN KEY ("occasion_id") REFERENCES "content"."supplication_occasions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."occasion_hadiths" ADD CONSTRAINT "occasion_hadiths_hadith_id_hadiths_id_fk" FOREIGN KEY ("hadith_id") REFERENCES "content"."hadiths"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."scholarly_differences" ADD CONSTRAINT "scholarly_differences_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."sunnah_hadiths" ADD CONSTRAINT "sunnah_hadiths_sunnah_id_sunnahs_id_fk" FOREIGN KEY ("sunnah_id") REFERENCES "content"."sunnahs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."sunnah_hadiths" ADD CONSTRAINT "sunnah_hadiths_hadith_id_hadiths_id_fk" FOREIGN KEY ("hadith_id") REFERENCES "content"."hadiths"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."sunnahs" ADD CONSTRAINT "sunnahs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."sunnahs" ADD CONSTRAINT "sunnahs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."supplication_occasions" ADD CONSTRAINT "supplication_occasions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."supplication_occasions" ADD CONSTRAINT "supplication_occasions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hadiths_source_number_rev_uq" ON "content"."hadiths" USING btree ("source_id","number","revision");--> statement-breakpoint
CREATE INDEX "hadiths_status_idx" ON "content"."hadiths" USING btree ("status");--> statement-breakpoint
CREATE INDEX "review_records_subject_idx" ON "content"."review_records" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "scholarly_differences_subject_idx" ON "content"."scholarly_differences" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sunnahs_slug_rev_uq" ON "content"."sunnahs" USING btree ("slug","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "sunnahs_slug_approved_uq" ON "content"."sunnahs" USING btree ("slug") WHERE "content"."sunnahs"."status" = 'approved';--> statement-breakpoint
CREATE UNIQUE INDEX "occasions_slug_rev_uq" ON "content"."supplication_occasions" USING btree ("slug","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "occasions_slug_approved_uq" ON "content"."supplication_occasions" USING btree ("slug") WHERE "content"."supplication_occasions"."status" = 'approved';