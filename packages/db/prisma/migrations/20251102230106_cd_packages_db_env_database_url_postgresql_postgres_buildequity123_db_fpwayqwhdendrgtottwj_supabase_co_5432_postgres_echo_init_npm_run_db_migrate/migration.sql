-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "payout" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "Run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scan" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT,
    "keyword" TEXT NOT NULL,
    "serpJson" JSONB,
    "signalsJson" JSONB,
    "demandScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "opportunity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profitEst" DOUBLE PRECISION,
    "classification" TEXT,
    "keywords" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "domainRating" DOUBLE PRECISION,
    "backlinks" INTEGER,
    "referringDomains" INTEGER,

    CONSTRAINT "Scan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VolumeSample" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "volume" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VolumeSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT,
    "payout" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Run_niche_createdAt_idx" ON "Run"("niche", "createdAt");

-- CreateIndex
CREATE INDEX "Scan_runId_city_state_idx" ON "Scan"("runId", "city", "state");

-- CreateIndex
CREATE INDEX "Scan_opportunity_idx" ON "Scan"("opportunity");

-- CreateIndex
CREATE INDEX "VolumeSample_keyword_city_state_capturedAt_idx" ON "VolumeSample"("keyword", "city", "state", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VolumeSample_keyword_city_state_key" ON "VolumeSample"("keyword", "city", "state");

-- CreateIndex
CREATE INDEX "Payout_city_state_idx" ON "Payout"("city", "state");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_city_state_zip_key" ON "Payout"("city", "state", "zip");

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
