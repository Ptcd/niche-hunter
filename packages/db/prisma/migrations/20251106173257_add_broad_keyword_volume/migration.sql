-- CreateTable
CREATE TABLE "BroadKeywordVolume" (
    "id" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "volume" INTEGER NOT NULL,
    "competition" DOUBLE PRECISION,
    "cpc" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'keywords-everywhere-api',

    CONSTRAINT "BroadKeywordVolume_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BroadKeywordVolume_niche_idx" ON "BroadKeywordVolume"("niche");

-- CreateIndex
CREATE INDEX "BroadKeywordVolume_volume_idx" ON "BroadKeywordVolume"("volume");

-- CreateIndex
CREATE UNIQUE INDEX "BroadKeywordVolume_niche_keyword_key" ON "BroadKeywordVolume"("niche", "keyword");
