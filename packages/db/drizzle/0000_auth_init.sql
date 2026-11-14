CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE TYPE "auth"."session_kind" AS ENUM('cookie', 'bearer');--> statement-breakpoint
CREATE TYPE "auth"."user_status" AS ENUM('active', 'pending_deletion');--> statement-breakpoint
CREATE TABLE "auth"."email_tokens" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"email" text NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"code_hash" "bytea" NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "auth"."sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"kind" "auth"."session_kind" NOT NULL,
	"device_label" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"absolute_expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "auth"."users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"email" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"status" "auth"."user_status" DEFAULT 'active' NOT NULL,
	"deletion_requested_at" timestamp with time zone,
	"plan_horizon" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_tokens_email_expires_idx" ON "auth"."email_tokens" USING btree ("email","expires_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "auth"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_uq" ON "auth"."users" USING btree (lower("email"));