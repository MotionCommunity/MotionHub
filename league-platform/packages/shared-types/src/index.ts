export type SeriesCode = "S-A" | "S-B" | "S-C" | string;

export interface PlayerSummary {
  id: string;
  ign: string;
  region?: string | null;
  discordUsername?: string | null;
}

export interface ReplayIngestRequest {
  replayFileId: string;
  gameId?: string;
}
