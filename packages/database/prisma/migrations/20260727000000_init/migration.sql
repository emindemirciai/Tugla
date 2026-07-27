-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PLAYER', 'SUPPORT', 'ANALYST', 'CONTENT_EDITOR', 'GAME_ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('PASSWORD', 'GOOGLE', 'APPLE');

-- CreateEnum
CREATE TYPE "LevelStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "GameMode" AS ENUM ('CAMPAIGN', 'DAILY', 'LEAGUE', 'COMMUNITY', 'BOSS_RUSH', 'ENDLESS');

-- CreateEnum
CREATE TYPE "GameSessionStatus" AS ENUM ('CREATED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'FAILED', 'ABANDONED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('CREDITS', 'CRYSTALS');

-- CreateEnum
CREATE TYPE "TaskCadence" AS ENUM ('DAILY', 'WEEKLY', 'SEASONAL', 'PERMANENT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'WAITING_USER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWING', 'ACTIONED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ActionTokenType" AS ENUM ('EMAIL_VERIFY', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'tr',
    "role" "UserRole" NOT NULL DEFAULT 'PLAYER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "emailVerifiedAt" TIMESTAMP(3),
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "searchVisible" BOOLEAN NOT NULL DEFAULT true,
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "acceptedTermsAt" TIMESTAMP(3) NOT NULL,
    "lastUsernameChangedAt" TIMESTAMP(3),
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceName" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "pushToken" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trustedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentLevel" INTEGER NOT NULL DEFAULT 1,
    "playerLevel" INTEGER NOT NULL DEFAULT 1,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "paddleLevel" INTEGER NOT NULL DEFAULT 1,
    "ballDamageLevel" INTEGER NOT NULL DEFAULT 1,
    "criticalLevel" INTEGER NOT NULL DEFAULT 1,
    "magnetLevel" INTEGER NOT NULL DEFAULT 1,
    "shieldLevel" INTEGER NOT NULL DEFAULT 1,
    "bossDamageLevel" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletBalance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Level" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "world" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "status" "LevelStatus" NOT NULL DEFAULT 'DRAFT',
    "definition" JSONB NOT NULL,
    "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "estimatedSeconds" INTEGER NOT NULL DEFAULT 180,
    "authorId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Level_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LevelVersion" (
    "id" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "definition" JSONB NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LevelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LevelRating" (
    "id" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "liked" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LevelRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "mode" "GameMode" NOT NULL,
    "status" "GameSessionStatus" NOT NULL DEFAULT 'CREATED',
    "seed" INTEGER NOT NULL,
    "signedNonce" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "livesRemaining" INTEGER NOT NULL DEFAULT 5,
    "maxBalls" INTEGER NOT NULL DEFAULT 1,
    "blocksDestroyed" INTEGER NOT NULL DEFAULT 0,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Replay" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "storageKey" TEXT,
    "events" JSONB NOT NULL,
    "checksum" TEXT NOT NULL,
    "eventCount" INTEGER NOT NULL,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Replay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBlock" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardEntry" (
    "id" TEXT NOT NULL,
    "boardKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "rank" INTEGER,
    "metadata" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaderboardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "seed" INTEGER NOT NULL,
    "rules" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueGroup" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "groupNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeagueGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueMembership" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "promoted" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cadence" "TaskCadence" NOT NULL,
    "target" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "rewards" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTaskProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "periodKey" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTaskProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "rewards" JSONB NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AchievementUnlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "unlockedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "AchievementUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogItem" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "currency" "Currency",
    "price" INTEGER,
    "platformSku" JSONB,
    "metadata" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "equipped" BOOLEAN NOT NULL DEFAULT false,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT,
    "provider" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "receipt" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "attachment" TEXT,
    "deviceInfo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModerationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ActionTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "rewards" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT 'ALL',
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_status_createdAt_idx" ON "User"("status", "createdAt");

-- CreateIndex
CREATE INDEX "User_displayName_idx" ON "User"("displayName");

-- CreateIndex
CREATE UNIQUE INDEX "AuthAccount_provider_providerAccountId_key" ON "AuthAccount"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "AuthAccount_userId_idx" ON "AuthAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshSession_tokenHash_key" ON "RefreshSession"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshSession_userId_revokedAt_idx" ON "RefreshSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "RefreshSession_expiresAt_idx" ON "RefreshSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Device_userId_fingerprint_key" ON "Device"("userId", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "UserProgress_userId_key" ON "UserProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletBalance_userId_currency_key" ON "WalletBalance"("userId", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "Level_slug_key" ON "Level"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Level_world_index_key" ON "Level"("world", "index");

-- CreateIndex
CREATE INDEX "Level_status_type_idx" ON "Level"("status", "type");

-- CreateIndex
CREATE INDEX "Level_authorId_status_idx" ON "Level"("authorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LevelVersion_levelId_version_key" ON "LevelVersion"("levelId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "LevelRating_levelId_userId_key" ON "LevelRating"("levelId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GameSession_signedNonce_key" ON "GameSession"("signedNonce");

-- CreateIndex
CREATE INDEX "GameSession_userId_status_idx" ON "GameSession"("userId", "status");

-- CreateIndex
CREATE INDEX "GameSession_mode_score_idx" ON "GameSession"("mode", "score");

-- CreateIndex
CREATE INDEX "GameSession_levelId_score_idx" ON "GameSession"("levelId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "Replay_sessionId_key" ON "Replay"("sessionId");

-- CreateIndex
CREATE INDEX "Replay_expiresAt_idx" ON "Replay"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_followerId_followingId_key" ON "Follow"("followerId", "followingId");

-- CreateIndex
CREATE INDEX "Follow_followingId_idx" ON "Follow"("followingId");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_requesterId_addresseeId_key" ON "Friendship"("requesterId", "addresseeId");

-- CreateIndex
CREATE INDEX "Friendship_addresseeId_status_idx" ON "Friendship"("addresseeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UserBlock_blockerId_blockedId_key" ON "UserBlock"("blockerId", "blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardEntry_boardKey_userId_key" ON "LeaderboardEntry"("boardKey", "userId");

-- CreateIndex
CREATE INDEX "LeaderboardEntry_boardKey_score_idx" ON "LeaderboardEntry"("boardKey", "score" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "League_key_key" ON "League"("key");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueGroup_leagueId_groupNumber_key" ON "LeagueGroup"("leagueId", "groupNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueMembership_groupId_userId_key" ON "LeagueMembership"("groupId", "userId");

-- CreateIndex
CREATE INDEX "LeagueMembership_groupId_score_idx" ON "LeagueMembership"("groupId", "score" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "TaskDefinition_key_key" ON "TaskDefinition"("key");

-- CreateIndex
CREATE UNIQUE INDEX "UserTaskProgress_userId_taskId_periodKey_key" ON "UserTaskProgress"("userId", "taskId", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_key_key" ON "Achievement"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AchievementUnlock_userId_achievementId_key" ON "AchievementUnlock"("userId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogItem_sku_key" ON "CatalogItem"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_userId_itemId_key" ON "InventoryItem"("userId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_transactionId_key" ON "Purchase"("transactionId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ModerationReport_status_createdAt_idx" ON "ModerationReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationReport_targetType_targetId_idx" ON "ModerationReport"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_createdAt_idx" ON "AuditLog"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ActionToken_tokenHash_key" ON "ActionToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ActionToken_userId_type_idx" ON "ActionToken"("userId", "type");

-- CreateIndex
CREATE INDEX "ActionToken_expiresAt_idx" ON "ActionToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Season_number_key" ON "Season"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Season_key_key" ON "Season"("key");

-- CreateIndex
CREATE INDEX "Season_active_startsAt_idx" ON "Season"("active", "startsAt");

-- CreateIndex
CREATE INDEX "Announcement_publishedAt_expiresAt_idx" ON "Announcement"("publishedAt", "expiresAt");

-- AddForeignKey
ALTER TABLE "AuthAccount" ADD CONSTRAINT "AuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletBalance" ADD CONSTRAINT "WalletBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Level" ADD CONSTRAINT "Level_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LevelVersion" ADD CONSTRAINT "LevelVersion_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LevelRating" ADD CONSTRAINT "LevelRating_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LevelRating" ADD CONSTRAINT "LevelRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Replay" ADD CONSTRAINT "Replay_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueGroup" ADD CONSTRAINT "LeagueGroup_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMembership" ADD CONSTRAINT "LeagueMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LeagueGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMembership" ADD CONSTRAINT "LeagueMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTaskProgress" ADD CONSTRAINT "UserTaskProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTaskProgress" ADD CONSTRAINT "UserTaskProgress_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TaskDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementUnlock" ADD CONSTRAINT "AchievementUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementUnlock" ADD CONSTRAINT "AchievementUnlock_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationReport" ADD CONSTRAINT "ModerationReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionToken" ADD CONSTRAINT "ActionToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
