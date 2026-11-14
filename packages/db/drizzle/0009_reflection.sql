CREATE TYPE "app"."answer_type" AS ENUM('yes_partly_no', 'text', 'both');--> statement-breakpoint
CREATE TYPE "app"."choice" AS ENUM('yes', 'partly', 'no', 'prefer_not');--> statement-breakpoint
CREATE TABLE "app"."daily_reflections" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"gratitude_ct" "bytea",
	"shortcoming_ct" "bytea",
	"repentance_noted" boolean DEFAULT false NOT NULL,
	"intention_ct" "bytea",
	"free_text_ct" "bytea",
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."reflection_answers" (
	"reflection_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"choice" "app"."choice",
	"text_ct" "bytea",
	CONSTRAINT "reflection_answers_reflection_id_question_id_pk" PRIMARY KEY("reflection_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "app"."reflection_questions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"catalog_key" text,
	"text_ct" "bytea",
	"answer_type" "app"."answer_type" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."user_keys" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"wrapped_dek" "bytea" NOT NULL,
	"master_key_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."daily_reflections" ADD CONSTRAINT "daily_reflections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."reflection_answers" ADD CONSTRAINT "reflection_answers_reflection_id_daily_reflections_id_fk" FOREIGN KEY ("reflection_id") REFERENCES "app"."daily_reflections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."reflection_answers" ADD CONSTRAINT "reflection_answers_question_id_reflection_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "app"."reflection_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."reflection_answers" ADD CONSTRAINT "reflection_answers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."reflection_questions" ADD CONSTRAINT "reflection_questions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_keys" ADD CONSTRAINT "user_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_reflections_day_uq" ON "app"."daily_reflections" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "reflection_questions_catalog_uq" ON "app"."reflection_questions" USING btree ("user_id","catalog_key") WHERE "app"."reflection_questions"."catalog_key" is not null;--> statement-breakpoint
CREATE INDEX "reflection_questions_user_idx" ON "app"."reflection_questions" USING btree ("user_id");