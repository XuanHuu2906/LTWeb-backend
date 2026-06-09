ALTER TABLE "cvs"
  ADD COLUMN IF NOT EXISTS "pdf_storage_path" TEXT;

ALTER TABLE "messages"
  ALTER COLUMN "content" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "message_type" TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS "attachment_path" TEXT,
  ADD COLUMN IF NOT EXISTS "attachment_name" TEXT,
  ADD COLUMN IF NOT EXISTS "attachment_mime" TEXT,
  ADD COLUMN IF NOT EXISTS "attachment_size" INTEGER;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "messages";
  END IF;
END $$;
