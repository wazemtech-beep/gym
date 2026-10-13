-- Additive and repeatable. Does not alter or delete existing gym records.
CREATE TABLE IF NOT EXISTS "RuntimeState" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "value" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "RuntimeState" ("key", "value") VALUES ('read-cache-revision', 'initial')
ON CONFLICT ("key") DO NOTHING;
