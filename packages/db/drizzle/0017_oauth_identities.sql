CREATE TYPE "auth"."oauth_provider" AS ENUM('google', 'apple');--> statement-breakpoint
CREATE TABLE "auth"."oauth_identities" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "auth"."oauth_provider" NOT NULL,
	"subject" text NOT NULL,
	"email" text,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."oauth_identities" ADD CONSTRAINT "oauth_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_identities_provider_subject_uq" ON "auth"."oauth_identities" USING btree ("provider","subject");--> statement-breakpoint
CREATE INDEX "oauth_identities_user_idx" ON "auth"."oauth_identities" USING btree ("user_id");