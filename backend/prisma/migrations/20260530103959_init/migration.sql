-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "githubId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scan" (
    "id" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "repoOwner" TEXT,
    "repoName" TEXT,
    "repoSize" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMsg" TEXT,
    "result" JSONB,
    "aiRecommendations" JSONB,
    "aiGeneratedAt" TIMESTAMP(3),
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanHistory" (
    "id" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "repoOwner" TEXT,
    "repoName" TEXT,
    "scanId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "grade" TEXT NOT NULL,
    "criticalCVEs" INTEGER NOT NULL DEFAULT 0,
    "highCVEs" INTEGER NOT NULL DEFAULT 0,
    "totalVulns" INTEGER NOT NULL DEFAULT 0,
    "outdatedDeps" INTEGER NOT NULL DEFAULT 0,
    "busFactorScore" INTEGER,
    "commitTrend" TEXT,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_githubId_key" ON "User"("githubId");

-- CreateIndex
CREATE INDEX "User_githubId_idx" ON "User"("githubId");

-- CreateIndex
CREATE INDEX "Scan_repoUrl_status_idx" ON "Scan"("repoUrl", "status");

-- CreateIndex
CREATE INDEX "Scan_status_createdAt_idx" ON "Scan"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Scan_userId_idx" ON "Scan"("userId");

-- CreateIndex
CREATE INDEX "ScanHistory_repoUrl_scannedAt_idx" ON "ScanHistory"("repoUrl", "scannedAt");

-- CreateIndex
CREATE INDEX "ScanHistory_repoUrl_idx" ON "ScanHistory"("repoUrl");

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
