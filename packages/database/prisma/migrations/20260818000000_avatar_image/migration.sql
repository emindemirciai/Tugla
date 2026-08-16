-- Avatar bytes for deployments without object storage.
--
-- A separate table on purpose: the image is large, rarely read, and never
-- needed by the queries that load a player, so keeping it out of "User" keeps
-- session lookups small.
CREATE TABLE "AvatarImage" (
    "userId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvatarImage_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "AvatarImage"
    ADD CONSTRAINT "AvatarImage_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
