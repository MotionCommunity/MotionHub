-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('scheduled', 'in_progress', 'completed', 'disputed');

-- CreateEnum
CREATE TYPE "ReplayParseStatus" AS ENUM ('pending', 'parsed', 'failed');

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "ign" TEXT NOT NULL,
    "discordUsername" TEXT,
    "discordUserId" TEXT,
    "epicGamesId" TEXT,
    "trackerUrl" TEXT,
    "region" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerAlias" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),

    CONSTRAINT "PlayerAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeriesTier" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,

    CONSTRAINT "SeriesTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerSeriesMembership" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "seriesTierId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "reason" TEXT NOT NULL,

    CONSTRAINT "PlayerSeriesMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "externalTournamentId" INTEGER,
    "name" TEXT NOT NULL,
    "format" TEXT,
    "bracketType" TEXT,
    "status" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seed" INTEGER,
    "placement" INTEGER,
    "discordRoleId" TEXT,
    "discordTextChannelId" TEXT,
    "discordVoiceChannelId" TEXT,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamPlayer" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "TeamPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "roundCode" TEXT,
    "slot" TEXT,
    "teamAId" TEXT,
    "teamBId" TEXT,
    "winnerTeamId" TEXT,
    "bestOf" INTEGER,
    "status" "MatchStatus" NOT NULL DEFAULT 'scheduled',
    "scheduledAt" TIMESTAMP(3),
    "playedAt" TIMESTAMP(3),
    "discordChannelId" TEXT,
    "teamARoleId" TEXT,
    "teamBRoleId" TEXT,
    "checkInMessageId" TEXT,
    "checkInRequestedAt" TIMESTAMP(3),
    "teamACheckedInAt" TIMESTAMP(3),
    "teamBCheckedInAt" TIMESTAMP(3),
    "discordPodTextChannelId" TEXT,
    "discordPodVoiceAChannelId" TEXT,
    "discordPodVoiceBChannelId" TEXT,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "gameNumber" INTEGER NOT NULL,
    "winnerTeamId" TEXT,
    "durationSeconds" INTEGER,
    "overtimeSeconds" INTEGER,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplayFile" (
    "id" TEXT NOT NULL,
    "gameId" TEXT,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT,
    "uploadedBy" TEXT,
    "parserStatus" "ReplayParseStatus" NOT NULL DEFAULT 'pending',
    "parserError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplayFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerGameStat" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "shots" INTEGER NOT NULL DEFAULT 0,
    "demosInflicted" INTEGER NOT NULL DEFAULT 0,
    "demosTaken" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "mvp" BOOLEAN NOT NULL DEFAULT false,
    "platform" TEXT,
    "onlineId" TEXT,
    "bpm" DOUBLE PRECISION,
    "avgBoostAmount" DOUBLE PRECISION,
    "amountCollected" DOUBLE PRECISION,
    "amountCollectedBig" DOUBLE PRECISION,
    "amountCollectedSmall" DOUBLE PRECISION,
    "countCollectedBig" INTEGER,
    "countCollectedSmall" INTEGER,
    "amountStolen" DOUBLE PRECISION,
    "amountStolenBig" DOUBLE PRECISION,
    "amountStolenSmall" DOUBLE PRECISION,
    "countStolenBig" INTEGER,
    "countStolenSmall" INTEGER,
    "timeZeroBoost" DOUBLE PRECISION,
    "timeFullBoost" DOUBLE PRECISION,
    "amountUsedWhileSupersonic" DOUBLE PRECISION,
    "amountOverfill" DOUBLE PRECISION,
    "amountOverfillStolen" DOUBLE PRECISION,
    "avgSpeed" DOUBLE PRECISION,
    "totalDistance" DOUBLE PRECISION,
    "timeSlowSpeed" DOUBLE PRECISION,
    "timeBoostSpeed" DOUBLE PRECISION,
    "timeSupersonic" DOUBLE PRECISION,
    "timeOnGround" DOUBLE PRECISION,
    "timeLowAir" DOUBLE PRECISION,
    "timeHighAir" DOUBLE PRECISION,
    "timePowerslide" DOUBLE PRECISION,
    "countPowerslide" INTEGER,
    "timeDefensiveThird" DOUBLE PRECISION,
    "timeNeutralThird" DOUBLE PRECISION,
    "timeOffensiveThird" DOUBLE PRECISION,
    "timeDefensiveHalf" DOUBLE PRECISION,
    "timeOffensiveHalf" DOUBLE PRECISION,
    "timeBehindBall" DOUBLE PRECISION,
    "timeInFrontBall" DOUBLE PRECISION,
    "avgDistanceToBall" DOUBLE PRECISION,
    "avgDistanceToBallHasPossession" DOUBLE PRECISION,
    "avgDistanceToBallNoPossession" DOUBLE PRECISION,
    "cameraFov" DOUBLE PRECISION,
    "cameraHeight" DOUBLE PRECISION,
    "cameraAngle" DOUBLE PRECISION,
    "cameraDistance" DOUBLE PRECISION,
    "cameraStiffness" DOUBLE PRECISION,
    "cameraSwivel" DOUBLE PRECISION,

    CONSTRAINT "PlayerGameStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerRatingHistory" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "mu" DOUBLE PRECISION,
    "sigma" DOUBLE PRECISION,
    "algorithmVersion" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerRatingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryHistory" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "oldSalary" INTEGER NOT NULL,
    "newSalary" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "algorithmVersion" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_ign_key" ON "Player"("ign");

-- CreateIndex
CREATE UNIQUE INDEX "SeriesTier_code_key" ON "SeriesTier"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Game_matchId_gameNumber_key" ON "Game"("matchId", "gameNumber");

-- AddForeignKey
ALTER TABLE "PlayerAlias" ADD CONSTRAINT "PlayerAlias_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerSeriesMembership" ADD CONSTRAINT "PlayerSeriesMembership_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerSeriesMembership" ADD CONSTRAINT "PlayerSeriesMembership_seriesTierId_fkey" FOREIGN KEY ("seriesTierId") REFERENCES "SeriesTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamPlayer" ADD CONSTRAINT "TeamPlayer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamPlayer" ADD CONSTRAINT "TeamPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplayFile" ADD CONSTRAINT "ReplayFile_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGameStat" ADD CONSTRAINT "PlayerGameStat_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGameStat" ADD CONSTRAINT "PlayerGameStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerRatingHistory" ADD CONSTRAINT "PlayerRatingHistory_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryHistory" ADD CONSTRAINT "SalaryHistory_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
