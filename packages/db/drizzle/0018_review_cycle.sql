CREATE TABLE "content"."reviewer_digests" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"last_sent_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content"."hadiths" ADD COLUMN "last_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "content"."hadiths" ADD COLUMN "review_due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "content"."sunnahs" ADD COLUMN "last_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "content"."sunnahs" ADD COLUMN "review_due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "content"."supplication_occasions" ADD COLUMN "last_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "content"."supplication_occasions" ADD COLUMN "review_due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "content"."reviewer_digests" ADD CONSTRAINT "reviewer_digests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Anything already published starts its cycle from its last update (12 months, the API default).
UPDATE content.hadiths SET last_verified_at = updated_at, review_due_at = updated_at + interval '365 days' WHERE status = 'approved';--> statement-breakpoint
UPDATE content.sunnahs SET last_verified_at = updated_at, review_due_at = updated_at + interval '365 days' WHERE status = 'approved';--> statement-breakpoint
UPDATE content.supplication_occasions SET last_verified_at = updated_at, review_due_at = updated_at + interval '365 days' WHERE status = 'approved';--> statement-breakpoint
-- The publication views select `*`, which Postgres expands when a view is created:
-- re-create them (same gate) so they carry last_verified_at for the public pages.
CREATE OR REPLACE VIEW content.published_hadiths AS
  SELECT h.*
  FROM content.hadiths h
  WHERE h.status = 'approved'
    AND h.text_ar IS NOT NULL AND btrim(h.text_ar) <> ''
    AND h.source_url IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM content.hadith_authentications a
      WHERE a.hadith_id = h.id AND a.is_primary
        AND a.grade IN ('sahih', 'hasan', 'sahih_li_ghayrihi', 'hasan_li_ghayrihi')
    );
--> statement-breakpoint
CREATE OR REPLACE VIEW content.published_sunnahs AS
  SELECT s.*
  FROM content.sunnahs s
  WHERE s.status = 'approved'
    AND EXISTS (SELECT 1 FROM content.sunnah_hadiths l WHERE l.sunnah_id = s.id)
    AND NOT EXISTS (
      SELECT 1 FROM content.sunnah_hadiths l
      WHERE l.sunnah_id = s.id
        AND l.hadith_id NOT IN (SELECT id FROM content.published_hadiths)
    );
--> statement-breakpoint
CREATE OR REPLACE VIEW content.published_occasions AS
  SELECT o.*
  FROM content.supplication_occasions o
  WHERE o.status = 'approved'
    AND EXISTS (SELECT 1 FROM content.occasion_hadiths l WHERE l.occasion_id = o.id)
    AND NOT EXISTS (
      SELECT 1 FROM content.occasion_hadiths l
      WHERE l.occasion_id = o.id
        AND l.hadith_id NOT IN (SELECT id FROM content.published_hadiths)
    );
