UPDATE "job_postings"
SET "status" = 'DANG_HOAT_DONG'
WHERE "status" IN ('active', 'approved');

UPDATE "job_postings"
SET "status" = 'CHO_DUYET'
WHERE "status" = 'pending';

ALTER TABLE "job_postings" ALTER COLUMN "status" SET DEFAULT 'CHO_DUYET';
