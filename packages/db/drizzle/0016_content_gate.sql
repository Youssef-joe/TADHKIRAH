-- Content integrity (CON-5, CON-9; docs/03-data-model.md §3.3, §4).
--> statement-breakpoint
-- 1. Review history and role audit are append-only.
CREATE OR REPLACE FUNCTION content.refuse_change() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER review_records_append_only BEFORE UPDATE OR DELETE ON content.review_records
  FOR EACH ROW EXECUTE FUNCTION content.refuse_change();
--> statement-breakpoint
CREATE TRIGGER role_audit_append_only BEFORE UPDATE OR DELETE ON auth.role_audit
  FOR EACH ROW EXECUTE FUNCTION content.refuse_change();
--> statement-breakpoint
-- The app role (user sessions) never touches editorial tables directly.
REVOKE ALL ON ALL TABLES IN SCHEMA content FROM tadhkirah_app;
--> statement-breakpoint
-- 2. The publication gate. The public content API reads ONLY these views.
-- A hadith is public when approved, complete (text + source link), and its primary
-- grading is sahih or hasan (or li-ghayrihi). A Sunnah or occasion is public when
-- approved, has evidence, and every hadith it links is public.
CREATE VIEW content.published_hadiths AS
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
CREATE VIEW content.published_sunnahs AS
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
CREATE VIEW content.published_occasions AS
  SELECT o.*
  FROM content.supplication_occasions o
  WHERE o.status = 'approved'
    AND EXISTS (SELECT 1 FROM content.occasion_hadiths l WHERE l.occasion_id = o.id)
    AND NOT EXISTS (
      SELECT 1 FROM content.occasion_hadiths l
      WHERE l.occasion_id = o.id
        AND l.hadith_id NOT IN (SELECT id FROM content.published_hadiths)
    );
--> statement-breakpoint
-- 3. Reference data: the six major collections (bibliographic metadata only).
INSERT INTO content.hadith_sources (key, name_ar, name_en, numbering_scheme, base_url) VALUES
  ('bukhari', 'صحيح البخاري', 'Sahih al-Bukhari', 'sunnah.com', 'https://sunnah.com/bukhari'),
  ('muslim', 'صحيح مسلم', 'Sahih Muslim', 'sunnah.com', 'https://sunnah.com/muslim'),
  ('abudawud', 'سنن أبي داود', 'Sunan Abi Dawud', 'sunnah.com', 'https://sunnah.com/abudawud'),
  ('tirmidhi', 'جامع الترمذي', 'Jami` at-Tirmidhi', 'sunnah.com', 'https://sunnah.com/tirmidhi'),
  ('nasai', 'سنن النسائي', 'Sunan an-Nasa''i', 'sunnah.com', 'https://sunnah.com/nasai'),
  ('ibnmajah', 'سنن ابن ماجه', 'Sunan Ibn Majah', 'sunnah.com', 'https://sunnah.com/ibnmajah')
ON CONFLICT (key) DO NOTHING;
