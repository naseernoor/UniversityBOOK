DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Gender') THEN
    CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationType') THEN
    CREATE TYPE "NotificationType" AS ENUM (
      'FRIEND_REQUEST',
      'FRIEND_REQUEST_ACCEPTED',
      'COMMENT_ON_POST',
      'REPLY_TO_COMMENT',
      'POST_MENTION',
      'COMMENT_MENTION',
      'MESSAGE_RECEIVED',
      'PROFILE_VERIFICATION_REQUEST',
      'PROFILE_VERIFICATION_STATUS',
      'SEMESTER_VERIFICATION_REQUEST',
      'SEMESTER_VERIFICATION_STATUS',
      'SYSTEM'
    );
  END IF;
END $$;

ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "gender" "Gender" NOT NULL DEFAULT 'PREFER_NOT_TO_SAY';

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "actorId" TEXT,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "link" TEXT,
  "dataJson" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Message" (
  "id" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx"
  ON "Notification"("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_idx"
  ON "Notification"("userId", "readAt");

CREATE INDEX IF NOT EXISTS "Message_senderId_recipientId_createdAt_idx"
  ON "Message"("senderId", "recipientId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Message_recipientId_readAt_createdAt_idx"
  ON "Message"("recipientId", "readAt", "createdAt" DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Notification_userId_fkey'
  ) THEN
    ALTER TABLE "Notification"
      ADD CONSTRAINT "Notification_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Notification_actorId_fkey'
  ) THEN
    ALTER TABLE "Notification"
      ADD CONSTRAINT "Notification_actorId_fkey"
      FOREIGN KEY ("actorId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Message_senderId_fkey'
  ) THEN
    ALTER TABLE "Message"
      ADD CONSTRAINT "Message_senderId_fkey"
      FOREIGN KEY ("senderId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Message_recipientId_fkey'
  ) THEN
    ALTER TABLE "Message"
      ADD CONSTRAINT "Message_recipientId_fkey"
      FOREIGN KEY ("recipientId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
