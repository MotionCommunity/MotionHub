import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Queue, Worker } from "bullmq";
import { PrismaClient, ReplayParseStatus, Prisma } from "@prisma/client";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6380";
const connection = { url: redisUrl };

const replayQueueName = "replay-ingest";
const replayQueue = new Queue(replayQueueName, { connection });
const prisma = new PrismaClient();
const uploadsDir = process.env.REPLAY_UPLOADS_DIR || "";
const isWin = process.platform === "win32";
const parserBinary = isWin ? "motion-replay-parse.exe" : "motion-replay-parse";

// Calibrated thresholds (matched to ballchasing.com output)
const GROUND_Z = 50;
const HIGH_AIR_Z = 900;
const SUPERSONIC_SPEED = 2200;
const BOOST_SPEED = 1450;
const SLOW_SPEED = 700;
const THIRD_Y = 1625;
const HALF_Y = 0;

// Big boost pad XY positions (6 pads on the standard field)
const BIG_PAD_POSITIONS: [number, number][] = [
  [-3072, -4096], [3072, -4096], [-3584, 0], [3584, 0], [-3072, 4096], [3072, 4096],
];
const BIG_PAD_RADIUS = 600;

function maybeNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function pickText(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function normalizeName(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function resolveReplayPath(storageKey: string): string {
  if (!storageKey) throw new Error("storageKey is empty");
  if (storageKey.startsWith("file://")) {
    const p = decodeURIComponent(storageKey.replace("file://", ""));
    if (fs.existsSync(p)) return p;
  }
  if (path.isAbsolute(storageKey) && fs.existsSync(storageKey)) return storageKey;
  if (uploadsDir) {
    const candidate = path.join(uploadsDir, storageKey);
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Replay file not found for storageKey: ${storageKey}`);
}

function resolveParserPath(): string {
  const custom = process.env.REPLAY_PARSER_PATH;
  if (custom && fs.existsSync(custom)) return custom;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidate = path.resolve(here, "../../../../hub-app/replay-parser-boxcars/target/release", parserBinary);
  if (fs.existsSync(candidate)) return candidate;
  throw new Error("Replay parser binary not found. Set REPLAY_PARSER_PATH or build hub-app/replay-parser-boxcars.");
}

function runReplayParser(parserPath: string, replayPath: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const proc = spawn(parserPath, [replayPath], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.setEncoding("utf8");
    proc.stderr.setEncoding("utf8");
    proc.stdout.on("data", (chunk: string) => (stdout += chunk));
    proc.stderr.on("data", (chunk: string) => (stderr += chunk));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(stderr || `Parser exited with ${code}`));
      try {
        resolve(JSON.parse(stdout));
      } catch (err) {
        reject(err);
      }
    });
  });
}

// ── Types ──

type Vec3 = { x: number; y: number; z: number };

type ExtractedPlayerStat = {
  ign: string;
  platform: string;
  onlineId: string;
  teamIndex: number;
  score: number;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  demosInflicted: number;
  demosTaken: number;
  mvp: boolean;
  // Boost
  bpm: number;
  avgBoostAmount: number;
  amountCollected: number;
  amountCollectedBig: number;
  amountCollectedSmall: number;
  countCollectedBig: number;
  countCollectedSmall: number;
  amountStolen: number;
  amountStolenBig: number;
  amountStolenSmall: number;
  countStolenBig: number;
  countStolenSmall: number;
  timeZeroBoost: number;
  timeFullBoost: number;
  amountUsedWhileSupersonic: number;
  amountOverfill: number;
  amountOverfillStolen: number;
  // Movement
  avgSpeed: number;
  totalDistance: number;
  timeSlowSpeed: number;
  timeBoostSpeed: number;
  timeSupersonic: number;
  timeOnGround: number;
  timeLowAir: number;
  timeHighAir: number;
  timePowerslide: number;
  countPowerslide: number;
  // Positioning
  timeDefensiveThird: number;
  timeNeutralThird: number;
  timeOffensiveThird: number;
  timeDefensiveHalf: number;
  timeOffensiveHalf: number;
  timeBehindBall: number;
  timeInFrontBall: number;
  avgDistanceToBall: number;
  avgDistanceToBallHasPossession: number;
  avgDistanceToBallNoPossession: number;
  // Camera
  cameraFov: number;
  cameraHeight: number;
  cameraAngle: number;
  cameraDistance: number;
  cameraStiffness: number;
  cameraSwivel: number;
};

type PlayerAccum = {
  ign: string;
  platform: string;
  onlineId: string;
  teamIndex: number;
  priActorId: number;
  carActorId: number;
  boostActorId: number;
  // Boost tracking
  lastBoost: number;
  boostInitialized: boolean;
  boostUsedRaw: number;
  boostCollectedRaw: number;
  amountCollectedBig: number;
  amountCollectedSmall: number;
  countCollectedBig: number;
  countCollectedSmall: number;
  amountStolenBig: number;
  amountStolenSmall: number;
  countStolenBig: number;
  countStolenSmall: number;
  amountOverfill: number;
  amountOverfillStolen: number;
  amountUsedWhileSupersonic: number;
  timeZeroBoost: number;
  timeFullBoost: number;
  boostSamples: number[];
  // Movement
  speeds: number[];
  totalDistance: number;
  timeSupersonic: number;
  timeBoostSpeed: number;
  timeSlowSpeed: number;
  timeOnGround: number;
  timeLowAir: number;
  timeHighAir: number;
  timePowerslide: number;
  countPowerslide: number;
  isPowersliding: boolean;
  // Positioning
  timeDefThird: number;
  timeNeutralThird: number;
  timeOffThird: number;
  timeDefHalf: number;
  timeOffHalf: number;
  timeBehindBall: number;
  timeInFrontBall: number;
  distancesToBall: number[];
  distToBallPossession: number[];
  distToBallNoPossession: number[];
  lastPos: Vec3 | null;
  lastSpeed: number;
  camera: { fov: number; height: number; angle: number; distance: number; stiffness: number; swivel: number } | null;
};

function isNearBigPad(x: number, y: number): boolean {
  for (const [px, py] of BIG_PAD_POSITIONS) {
    const dx = x - px;
    const dy = y - py;
    if (Math.sqrt(dx * dx + dy * dy) < BIG_PAD_RADIUS) return true;
  }
  return false;
}

function newPlayerAccum(priActorId: number): PlayerAccum {
  return {
    ign: "", platform: "", onlineId: "", teamIndex: -1,
    priActorId, carActorId: -1, boostActorId: -1,
    lastBoost: 33, boostInitialized: false,
    boostUsedRaw: 0, boostCollectedRaw: 0,
    amountCollectedBig: 0, amountCollectedSmall: 0,
    countCollectedBig: 0, countCollectedSmall: 0,
    amountStolenBig: 0, amountStolenSmall: 0,
    countStolenBig: 0, countStolenSmall: 0,
    amountOverfill: 0, amountOverfillStolen: 0,
    amountUsedWhileSupersonic: 0,
    timeZeroBoost: 0, timeFullBoost: 0,
    boostSamples: [],
    speeds: [], totalDistance: 0,
    timeSupersonic: 0, timeBoostSpeed: 0, timeSlowSpeed: 0,
    timeOnGround: 0, timeLowAir: 0, timeHighAir: 0,
    timePowerslide: 0, countPowerslide: 0, isPowersliding: false,
    timeDefThird: 0, timeNeutralThird: 0, timeOffThird: 0,
    timeDefHalf: 0, timeOffHalf: 0,
    timeBehindBall: 0, timeInFrontBall: 0,
    distancesToBall: [],
    distToBallPossession: [], distToBallNoPossession: [],
    lastPos: null, lastSpeed: 0, camera: null,
  };
}

// ── Frame analysis ──

function analyzeFrames(parsed: Record<string, unknown>): Map<string, Partial<ExtractedPlayerStat>> {
  const objects = (parsed.objects as string[]) || [];
  const networkFrames = parsed.network_frames as { frames: unknown[] } | undefined;
  if (!networkFrames?.frames?.length) return new Map();
  const frames = networkFrames.frames as Array<{
    time: number;
    delta: number;
    new_actors: Array<{ actor_id: number; object_id: number; name_id?: number }>;
    deleted_actors: number[];
    updated_actors: Array<{ actor_id: number; stream_id: number; object_id: number; attribute: Record<string, unknown> }>;
  }>;

  const objName = (id: number) => (id >= 0 && id < objects.length ? objects[id] : "");

  // Find object index for handbrake attribute
  const handbrakeObjId = objects.findIndex(o => o.includes("bReplicatedHandbrake"));

  const actorType = new Map<number, string>();
  const parentOf = new Map<number, number>();
  const playerByPri = new Map<number, PlayerAccum>();
  const boostToPri = new Map<number, number>();
  const carToPri = new Map<number, number>();
  const boostToCar = new Map<number, number>();

  let ballPos: Vec3 = { x: 0, y: 0, z: 0 };
  let gameDurationFromFrames = 0;

  function resolveBoostLinks() {
    for (const [boostId, carId] of boostToCar) {
      if (boostToPri.has(boostId)) continue;
      const priId = carToPri.get(carId);
      if (priId !== undefined) {
        boostToPri.set(boostId, priId);
        const p = playerByPri.get(priId);
        if (p) p.boostActorId = boostId;
      }
    }
  }

  function priFromCar(carId: number): number | undefined {
    let priId = carToPri.get(carId);
    if (priId !== undefined) return priId;
    const parentId = parentOf.get(carId);
    if (parentId !== undefined && playerByPri.has(parentId)) {
      carToPri.set(carId, parentId);
      const p = playerByPri.get(parentId);
      if (p) p.carActorId = carId;
      return parentId;
    }
    return undefined;
  }

  // Find closest player to ball for possession tracking
  function closestToBall(): number | undefined {
    let minDist = Infinity;
    let closest: number | undefined;
    for (const [priId, p] of playerByPri) {
      if (!p.lastPos) continue;
      const dx = p.lastPos.x - ballPos.x;
      const dy = p.lastPos.y - ballPos.y;
      const dz = p.lastPos.z - ballPos.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < minDist) { minDist = d; closest = priId; }
    }
    return closest;
  }

  for (const frame of frames) {
    const dt = frame.delta;
    const skipStats = dt <= 0 || dt > 1;
    if (!skipStats) gameDurationFromFrames += dt;

    for (const na of frame.new_actors) {
      const name = objName(na.object_id);
      actorType.set(na.actor_id, name);
      if (name.includes("PRI_TA") && !playerByPri.has(na.actor_id)) {
        playerByPri.set(na.actor_id, newPlayerAccum(na.actor_id));
      }
    }

    for (const da of frame.deleted_actors) {
      actorType.delete(da);
    }

    // Pass 1: ActiveActor links
    for (const ua of frame.updated_actors) {
      const attr = ua.attribute;
      if (!attr || typeof attr !== "object") continue;
      if (!("ActiveActor" in attr)) continue;
      const aa = attr.ActiveActor as { active?: boolean; actor?: number };
      if (!aa || typeof aa.actor !== "number" || aa.actor < 0) continue;
      parentOf.set(ua.actor_id, aa.actor);
      const childType = actorType.get(ua.actor_id) || "";
      const parentType = actorType.get(aa.actor) || "";
      if (childType.includes("Car_Default") || childType.includes("Car_TA")) {
        if (parentType.includes("PRI_TA")) {
          carToPri.set(ua.actor_id, aa.actor);
          const p = playerByPri.get(aa.actor);
          if (p) p.carActorId = ua.actor_id;
        }
      }
      if (childType.includes("CarComponent_Boost")) {
        boostToCar.set(ua.actor_id, aa.actor);
      }
    }
    resolveBoostLinks();

    // Pass 2: data attributes
    for (const ua of frame.updated_actors) {
      const attr = ua.attribute;
      if (!attr || typeof attr !== "object") continue;

      if ("String" in attr) {
        const p = playerByPri.get(ua.actor_id);
        if (p && !p.ign) {
          const val = attr.String as string;
          if (val && typeof val === "string" && val.trim()) p.ign = val.trim();
        }
      }

      if ("Int" in attr) {
        const p = playerByPri.get(ua.actor_id);
        if (p && p.teamIndex < 0) {
          const val = attr.Int as number;
          if (typeof val === "number" && (val === 0 || val === 1)) p.teamIndex = val;
        }
      }

      if ("UniqueId" in attr) {
        const p = playerByPri.get(ua.actor_id);
        if (p) {
          const uid = attr.UniqueId as Record<string, unknown>;
          if (uid) {
            const remote = uid.remote_id as Record<string, unknown> | undefined;
            if (remote) {
              for (const [k, v] of Object.entries(remote)) {
                if (k.toLowerCase().includes("steam") && typeof v === "string") {
                  p.platform = "Steam"; p.onlineId = v;
                } else if (k.toLowerCase().includes("epic") && typeof v === "string") {
                  p.platform = "Epic"; p.onlineId = v;
                } else if (k.toLowerCase().includes("xbox") && typeof v === "string") {
                  p.platform = "Xbox"; p.onlineId = v;
                } else if (k.toLowerCase().includes("playstation") || k.toLowerCase().includes("ps")) {
                  // PlayStation remote_id is often an object: { online_id, name, ... }
                  if (typeof v === "string") {
                    p.platform = "PlayStation";
                    p.onlineId = v;
                  } else if (v && typeof v === "object") {
                    const vv = v as Record<string, unknown>;
                    const onlineId = pickText(vv, ["online_id", "onlineId"]);
                    const psName = pickText(vv, ["name"]);
                    p.platform = "PlayStation";
                    if (onlineId) p.onlineId = onlineId;
                    // Replace masked PRI names when real PSN name is available.
                    if (psName && (!p.ign || p.ign === "********")) p.ign = psName;
                  }
                }
              }
            }
          }
        }
      }

      if ("CamSettings" in attr) {
        const priId = parentOf.get(ua.actor_id);
        const p = priId !== undefined ? playerByPri.get(priId) : undefined;
        if (p) {
          const cam = attr.CamSettings as Record<string, number>;
          p.camera = {
            fov: cam.fov ?? 0, height: cam.height ?? 0, angle: cam.angle ?? 0,
            distance: cam.distance ?? 0, stiffness: cam.stiffness ?? 0, swivel: cam.swivel ?? 0,
          };
        }
      }

      // Boost amount tracking + pickup detection
      if ("ReplicatedBoost" in attr) {
        const rb = attr.ReplicatedBoost as { boost_amount?: number };
        if (rb && typeof rb.boost_amount === "number") {
          let priId = boostToPri.get(ua.actor_id);
          if (priId === undefined) {
            const carId = boostToCar.get(ua.actor_id) ?? parentOf.get(ua.actor_id);
            if (carId !== undefined) {
              priId = priFromCar(carId);
              if (priId !== undefined) boostToPri.set(ua.actor_id, priId);
            }
          }
          if (priId !== undefined) {
            const p = playerByPri.get(priId);
            if (p) {
              const newBoost = rb.boost_amount;
              const oldBoost = p.lastBoost;

              if (!p.boostInitialized) {
                p.boostInitialized = true;
                p.lastBoost = newBoost;
                continue;
              }

              if (newBoost < oldBoost) {
                const used = oldBoost - newBoost;
                p.boostUsedRaw += used;
                if (p.lastSpeed >= SUPERSONIC_SPEED) {
                  p.amountUsedWhileSupersonic += (used / 255) * 100;
                }
              }

              // Detect pad pickup from boost increase (only during active play)
              if (newBoost > oldBoost && !skipStats) {
                const delta = newBoost - oldBoost;
                if (delta >= 5) {
                  const amountPct = (delta / 255) * 100;
                  const inOpponentHalf = p.lastPos && p.teamIndex >= 0
                    ? (p.teamIndex === 0 ? p.lastPos.y > 0 : p.lastPos.y < 0)
                    : false;

                  let isBig = false;
                  if (p.lastPos) {
                    isBig = isNearBigPad(p.lastPos.x, p.lastPos.y);
                  } else {
                    isBig = delta >= 60;
                  }

                  // Overfill: boost gained beyond what could be stored (capped at 255)
                  const maxCanGain = 255 - oldBoost;
                  const overfill = isBig ? Math.max(0, (255 - oldBoost) > 0 ? 0 : amountPct) : 0;
                  // For big pads, overfill = max(0, 100 - (255-oldBoost)/255*100)
                  const bigPadFull = 100; // big pad gives 100%
                  if (isBig) {
                    const couldGain = ((255 - oldBoost) / 255) * 100;
                    const overfillAmt = Math.max(0, bigPadFull - couldGain);
                    p.amountOverfill += overfillAmt;
                    if (inOpponentHalf) p.amountOverfillStolen += overfillAmt;
                  }

                  if (isBig) {
                    p.countCollectedBig++;
                    p.amountCollectedBig += amountPct;
                    p.boostCollectedRaw += delta;
                    if (inOpponentHalf) {
                      p.countStolenBig++;
                      p.amountStolenBig += amountPct;
                    }
                  } else {
                    p.countCollectedSmall++;
                    p.amountCollectedSmall += amountPct;
                    p.boostCollectedRaw += delta;
                    if (inOpponentHalf) {
                      p.countStolenSmall++;
                      p.amountStolenSmall += amountPct;
                    }
                  }
                }
              }

              p.lastBoost = newBoost;
              p.boostSamples.push(newBoost);
            }
          }
        }
      }

      // Powerslide tracking (bReplicatedHandbrake is a Boolean on Car actors)
      if ("Boolean" in attr && handbrakeObjId >= 0 && ua.object_id === handbrakeObjId) {
        const priId = priFromCar(ua.actor_id);
        if (priId !== undefined) {
          const p = playerByPri.get(priId);
          if (p) {
            const isHandbrake = attr.Boolean as boolean;
            if (isHandbrake && !p.isPowersliding) {
              p.isPowersliding = true;
              p.countPowerslide++;
            } else if (!isHandbrake) {
              p.isPowersliding = false;
            }
          }
        }
      }

      // RigidBody: ball + car positions
      if ("RigidBody" in attr) {
        const rb = attr.RigidBody as { location?: Vec3; linear_velocity?: Vec3 };
        const type = actorType.get(ua.actor_id) || "";

        if (type.includes("Ball")) {
          if (rb?.location) ballPos = rb.location;
        }

        const priId = priFromCar(ua.actor_id);
        if (priId !== undefined && rb?.location) {
          const p = playerByPri.get(priId);
          if (p) {
            const pos = rb.location;
            if (!skipStats) {
              // Speed
              const vel = rb.linear_velocity;
              let speed = 0;
              if (vel) {
                speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
                p.speeds.push(speed);
                p.lastSpeed = speed;
                if (speed >= SUPERSONIC_SPEED) p.timeSupersonic += dt;
                else if (speed >= BOOST_SPEED) p.timeBoostSpeed += dt;
                else p.timeSlowSpeed += dt;
              }

              // Distance
              if (p.lastPos) {
                const dx = pos.x - p.lastPos.x;
                const dy = pos.y - p.lastPos.y;
                const dz = pos.z - p.lastPos.z;
                p.totalDistance += Math.sqrt(dx * dx + dy * dy + dz * dz);
              }

              // Height classification
              if (pos.z < GROUND_Z) p.timeOnGround += dt;
              else if (pos.z < HIGH_AIR_Z) p.timeLowAir += dt;
              else p.timeHighAir += dt;

              // Third classification
              const signedY = p.teamIndex === 1 ? -pos.y : pos.y;
              if (signedY < -THIRD_Y) p.timeDefThird += dt;
              else if (signedY > THIRD_Y) p.timeOffThird += dt;
              else p.timeNeutralThird += dt;

              // Half classification
              if (signedY < HALF_Y) p.timeDefHalf += dt;
              else p.timeOffHalf += dt;

              // Behind/in front of ball
              const ballSignedY = p.teamIndex === 1 ? -ballPos.y : ballPos.y;
              if (signedY < ballSignedY) p.timeBehindBall += dt;
              else p.timeInFrontBall += dt;

              // Distance to ball
              const dbx = pos.x - ballPos.x;
              const dby = pos.y - ballPos.y;
              const dbz = pos.z - ballPos.z;
              const distToBall = Math.sqrt(dbx * dbx + dby * dby + dbz * dbz);
              p.distancesToBall.push(distToBall);

              // Possession-based distance (closest player "has possession")
              const closestPri = closestToBall();
              if (closestPri === priId) {
                p.distToBallPossession.push(distToBall);
              } else {
                p.distToBallNoPossession.push(distToBall);
              }

              // Boost time tracking (using last known boost with dt)
              if (p.boostInitialized) {
                if (p.lastBoost <= 0) p.timeZeroBoost += dt;
                if (p.lastBoost >= 255) p.timeFullBoost += dt;
              }

              // Powerslide time (only counts when wheels are on the surface, z≈17 at rest)
              if (p.isPowersliding && pos.z < 30) p.timePowerslide += dt;
            }
            p.lastPos = { ...pos };
          }
        }
      }
    }
  }

  if (gameDurationFromFrames === 0) return new Map();

  const properties = parsed.properties as Record<string, unknown> | undefined;
  const gameDuration = gameDurationFromFrames;
  const gameDurationMinutes = gameDuration / 60;

  const result = new Map<string, Partial<ExtractedPlayerStat>>();

  // Build maps for fallback matching
  const byOnlineId = new Map<string, Partial<ExtractedPlayerStat>>();
  const byNormalizedName = new Map<string, Partial<ExtractedPlayerStat>>();

  for (const p of playerByPri.values()) {
    if (!p.ign) continue;

    const avgBoostRaw = p.boostSamples.length > 0
      ? p.boostSamples.reduce((a, b) => a + b, 0) / p.boostSamples.length
      : 0;
    const avgSpeed = p.speeds.length > 0
      ? p.speeds.reduce((a, b) => a + b, 0) / p.speeds.length
      : 0;
    const avgDistToBall = p.distancesToBall.length > 0
      ? p.distancesToBall.reduce((a, b) => a + b, 0) / p.distancesToBall.length
      : 0;
    const avgDistPoss = p.distToBallPossession.length > 0
      ? p.distToBallPossession.reduce((a, b) => a + b, 0) / p.distToBallPossession.length
      : 0;
    const avgDistNoPoss = p.distToBallNoPossession.length > 0
      ? p.distToBallNoPossession.reduce((a, b) => a + b, 0) / p.distToBallNoPossession.length
      : 0;

    const totalAmountCollected = p.amountCollectedBig + p.amountCollectedSmall;
    const totalAmountStolen = p.amountStolenBig + p.amountStolenSmall;

    const r1 = (v: number) => Math.round(v * 10) / 10;
    const r0 = (v: number) => Math.round(v);

    const stat: Partial<ExtractedPlayerStat> = {
      platform: p.platform || undefined,
      onlineId: p.onlineId || undefined,
      teamIndex: p.teamIndex,
      bpm: r0(p.boostSamples.length > 0 ? (p.boostCollectedRaw / 255 * 100) / gameDurationMinutes : 0),
      avgBoostAmount: r1((avgBoostRaw / 255) * 100),
      amountCollected: r0(totalAmountCollected),
      amountCollectedBig: r0(p.amountCollectedBig),
      amountCollectedSmall: r0(p.amountCollectedSmall),
      countCollectedBig: p.countCollectedBig,
      countCollectedSmall: p.countCollectedSmall,
      amountStolen: r0(totalAmountStolen),
      amountStolenBig: r0(p.amountStolenBig),
      amountStolenSmall: r0(p.amountStolenSmall),
      countStolenBig: p.countStolenBig,
      countStolenSmall: p.countStolenSmall,
      timeZeroBoost: r1(p.timeZeroBoost),
      timeFullBoost: r1(p.timeFullBoost),
      amountUsedWhileSupersonic: r0(p.amountUsedWhileSupersonic),
      amountOverfill: r0(p.amountOverfill),
      amountOverfillStolen: r0(p.amountOverfillStolen),
      avgSpeed: r0(avgSpeed),
      totalDistance: r0(p.totalDistance),
      timeSlowSpeed: r1(p.timeSlowSpeed),
      timeBoostSpeed: r1(p.timeBoostSpeed),
      timeSupersonic: r1(p.timeSupersonic),
      timeOnGround: r1(p.timeOnGround),
      timeLowAir: r1(p.timeLowAir),
      timeHighAir: r1(p.timeHighAir),
      timePowerslide: r1(p.timePowerslide),
      countPowerslide: p.countPowerslide,
      timeDefensiveThird: r1(p.timeDefThird),
      timeNeutralThird: r1(p.timeNeutralThird),
      timeOffensiveThird: r1(p.timeOffThird),
      timeDefensiveHalf: r1(p.timeDefHalf),
      timeOffensiveHalf: r1(p.timeOffHalf),
      timeBehindBall: r1(p.timeBehindBall),
      timeInFrontBall: r1(p.timeInFrontBall),
      avgDistanceToBall: r0(avgDistToBall),
      avgDistanceToBallHasPossession: r0(avgDistPoss),
      avgDistanceToBallNoPossession: r0(avgDistNoPoss),
      cameraFov: p.camera?.fov ?? undefined,
      cameraHeight: p.camera?.height ?? undefined,
      cameraAngle: p.camera?.angle ?? undefined,
      cameraDistance: p.camera?.distance ?? undefined,
      cameraStiffness: p.camera?.stiffness ?? undefined,
      cameraSwivel: p.camera?.swivel ?? undefined,
    };

    result.set(p.ign.toLowerCase(), stat);
    if (p.onlineId) byOnlineId.set(p.onlineId, stat);
    const norm = normalizeName(p.ign);
    if (norm) byNormalizedName.set(norm, stat);
  }

  // Attach fallback maps for buildFinalStats
  (result as any).__byOnlineId = byOnlineId;
  (result as any).__byNormalizedName = byNormalizedName;

  return result;
}

// ── Scoreboard extraction ──

type ScoreboardStat = {
  ign: string;
  platform: string;
  onlineId: string;
  teamIndex: number;
  score: number;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  mvp: boolean;
};

function extractScoreboard(parsed: Record<string, unknown>): ScoreboardStat[] {
  const props = parsed.properties as Record<string, unknown> | undefined;
  if (!props) return [];
  const playerStats = props.PlayerStats;
  if (!Array.isArray(playerStats)) return [];

  return playerStats
    .filter((ps: unknown) => ps && typeof ps === "object")
    .map((ps: Record<string, unknown>) => {
      const name = pickText(ps, ["Name", "name"]);
      if (!name) return null;
      let platform = "";
      let onlineId = "";
      const plat = ps.Platform as Record<string, unknown> | undefined;
      if (plat?.value) {
        const v = String(plat.value);
        if (v.includes("Steam")) platform = "Steam";
        else if (v.includes("Epic")) platform = "Epic";
        else if (v.includes("PS")) platform = "PlayStation";
        else if (v.includes("Xbox")) platform = "Xbox";
        else platform = v.replace("OnlinePlatform_", "");
      }
      const rawId = pickText(ps, ["OnlineID"]);
      if (rawId && rawId !== "0") onlineId = rawId;
      const pidFields = (ps.PlayerID as Record<string, unknown>)?.fields as Record<string, unknown> | undefined;
      if (pidFields) {
        const uid = pickText(pidFields, ["Uid"]);
        const epicId = pickText(pidFields, ["EpicAccountId"]);
        if (epicId) { platform = "Epic"; onlineId = epicId; }
        else if (uid && uid !== "0") { onlineId = uid; }
      }

      return {
        ign: name,
        platform,
        onlineId,
        teamIndex: maybeNum(ps.Team ?? ps.team),
        score: maybeNum(ps.Score ?? ps.score),
        goals: maybeNum(ps.Goals ?? ps.goals),
        assists: maybeNum(ps.Assists ?? ps.assists),
        saves: maybeNum(ps.Saves ?? ps.saves),
        shots: maybeNum(ps.Shots ?? ps.shots),
        mvp: false,
      } as ScoreboardStat;
    })
    .filter(Boolean) as ScoreboardStat[];
}

// ── Merge scoreboard + frame analysis ──

function buildFinalStats(parsed: Record<string, unknown>): ExtractedPlayerStat[] {
  const scoreboard = extractScoreboard(parsed);
  const frameStats = analyzeFrames(parsed);
  const byOnlineId = (frameStats as any).__byOnlineId as Map<string, Partial<ExtractedPlayerStat>> | undefined;
  const byNormalizedName = (frameStats as any).__byNormalizedName as Map<string, Partial<ExtractedPlayerStat>> | undefined;

  const merged: ExtractedPlayerStat[] = scoreboard.flatMap((sb) => {
    const key = sb.ign.toLowerCase();
    let fs = frameStats.get(key);

    // Fallback: match by onlineId if name didn't match (handles Unicode IGNs)
    if (!fs && sb.onlineId && byOnlineId) {
      fs = byOnlineId.get(sb.onlineId);
    }
    // Fallback: normalized name match (handles diacritics/symbol variants)
    if (!fs && byNormalizedName) {
      const norm = normalizeName(sb.ign);
      if (norm) fs = byNormalizedName.get(norm);
    }
    if (!fs) fs = {};

    // Drop obvious ghost/spectator rows from scoreboard-only data.
    const hasFrameData = (fs.totalDistance ?? 0) > 0 || (fs.avgSpeed ?? 0) > 0;
    const isAllZeroScoreboard =
      sb.score === 0 && sb.goals === 0 && sb.assists === 0 && sb.saves === 0 && sb.shots === 0;
    const looksGhost = !hasFrameData && isAllZeroScoreboard && !sb.onlineId;
    if (looksGhost) return [];

    return {
      ign: sb.ign,
      platform: fs.platform || sb.platform || "",
      onlineId: fs.onlineId || sb.onlineId || "",
      teamIndex: sb.teamIndex >= 0 ? sb.teamIndex : (fs.teamIndex ?? -1),
      score: sb.score,
      goals: sb.goals,
      assists: sb.assists,
      saves: sb.saves,
      shots: sb.shots,
      demosInflicted: 0,
      demosTaken: 0,
      mvp: false,
      bpm: fs.bpm ?? 0,
      avgBoostAmount: fs.avgBoostAmount ?? 0,
      amountCollected: fs.amountCollected ?? 0,
      amountCollectedBig: fs.amountCollectedBig ?? 0,
      amountCollectedSmall: fs.amountCollectedSmall ?? 0,
      countCollectedBig: fs.countCollectedBig ?? 0,
      countCollectedSmall: fs.countCollectedSmall ?? 0,
      amountStolen: fs.amountStolen ?? 0,
      amountStolenBig: fs.amountStolenBig ?? 0,
      amountStolenSmall: fs.amountStolenSmall ?? 0,
      countStolenBig: fs.countStolenBig ?? 0,
      countStolenSmall: fs.countStolenSmall ?? 0,
      timeZeroBoost: fs.timeZeroBoost ?? 0,
      timeFullBoost: fs.timeFullBoost ?? 0,
      amountUsedWhileSupersonic: fs.amountUsedWhileSupersonic ?? 0,
      amountOverfill: fs.amountOverfill ?? 0,
      amountOverfillStolen: fs.amountOverfillStolen ?? 0,
      avgSpeed: fs.avgSpeed ?? 0,
      totalDistance: fs.totalDistance ?? 0,
      timeSlowSpeed: fs.timeSlowSpeed ?? 0,
      timeBoostSpeed: fs.timeBoostSpeed ?? 0,
      timeSupersonic: fs.timeSupersonic ?? 0,
      timeOnGround: fs.timeOnGround ?? 0,
      timeLowAir: fs.timeLowAir ?? 0,
      timeHighAir: fs.timeHighAir ?? 0,
      timePowerslide: fs.timePowerslide ?? 0,
      countPowerslide: fs.countPowerslide ?? 0,
      timeDefensiveThird: fs.timeDefensiveThird ?? 0,
      timeNeutralThird: fs.timeNeutralThird ?? 0,
      timeOffensiveThird: fs.timeOffensiveThird ?? 0,
      timeDefensiveHalf: fs.timeDefensiveHalf ?? 0,
      timeOffensiveHalf: fs.timeOffensiveHalf ?? 0,
      timeBehindBall: fs.timeBehindBall ?? 0,
      timeInFrontBall: fs.timeInFrontBall ?? 0,
      avgDistanceToBall: fs.avgDistanceToBall ?? 0,
      avgDistanceToBallHasPossession: fs.avgDistanceToBallHasPossession ?? 0,
      avgDistanceToBallNoPossession: fs.avgDistanceToBallNoPossession ?? 0,
      cameraFov: fs.cameraFov ?? 0,
      cameraHeight: fs.cameraHeight ?? 0,
      cameraAngle: fs.cameraAngle ?? 0,
      cameraDistance: fs.cameraDistance ?? 0,
      cameraStiffness: fs.cameraStiffness ?? 0,
      cameraSwivel: fs.cameraSwivel ?? 0,
    };
  });

  if (merged.length > 0 && !merged.some((r) => r.mvp)) {
    let top = merged[0];
    for (const r of merged) if (r.score > top.score) top = r;
    top.mvp = true;
  }

  return merged;
}

// ── DB helpers ──

async function ensureImportGame(tx: Prisma.TransactionClient, replayFileId: string, existingGameId: string | null) {
  if (existingGameId) {
    const found = await tx.game.findUnique({ where: { id: existingGameId } });
    if (found) return found;
  }

  let tournament = await tx.tournament.findFirst({ where: { name: "__Replay Imports__", status: "import" } });
  if (!tournament) {
    tournament = await tx.tournament.create({
      data: { name: "__Replay Imports__", status: "import", format: "unknown", bracketType: "unknown" }
    });
  }

  const match = await tx.match.create({
    data: {
      tournamentId: tournament.id,
      status: "completed",
      playedAt: new Date(),
      bestOf: 1,
      roundCode: "IMPORT",
      slot: replayFileId.slice(0, 8)
    }
  });

  return tx.game.create({ data: { matchId: match.id, gameNumber: 1 } });
}

// ── Worker ──

const worker = new Worker(
  replayQueueName,
  async (job) => {
    if (job.name !== "ingest-replay") {
      console.log("[worker] skip", job.id, job.name);
      return { skipped: true };
    }

    const replayFileId = String(job.data?.replayFileId || "").trim();
    if (!replayFileId) throw new Error("replayFileId is required");

    const replay = await prisma.replayFile.findUnique({ where: { id: replayFileId } });
    if (!replay) throw new Error("Replay file not found");
    const replayPath = resolveReplayPath(replay.storageKey);
    const parserPath = resolveParserPath();
    const parsed = await runReplayParser(parserPath, replayPath) as Record<string, unknown>;

    console.log("[worker] analyzing frames...");
    const extracted = buildFinalStats(parsed);
    console.log(`[worker] extracted ${extracted.length} players`);

    const props = parsed.properties as Record<string, unknown> | undefined;
    const gameDuration = Math.round(maybeNum(props?.TotalSecondsPlayed ?? 0)) || undefined;

    await prisma.$transaction(async (tx) => {
      const game = await ensureImportGame(tx, replayFileId, replay.gameId ?? null);

      if (gameDuration) {
        await tx.game.update({ where: { id: game.id }, data: { durationSeconds: gameDuration } });
      }

      await tx.replayFile.update({
        where: { id: replayFileId },
        data: { gameId: game.id, parserStatus: ReplayParseStatus.parsed, parserError: null }
      });

      await tx.playerGameStat.deleteMany({ where: { gameId: game.id } });

      for (const stat of extracted) {
        let player = await tx.player.findFirst({
          where: { ign: { equals: stat.ign, mode: "insensitive" } }
        });
        if (!player) {
          player = await tx.player.create({ data: { ign: stat.ign } });
        }
        await tx.playerGameStat.create({
          data: {
            gameId: game.id,
            playerId: player.id,
            teamId: null,
            score: Math.round(stat.score),
            goals: Math.round(stat.goals),
            assists: Math.round(stat.assists),
            saves: Math.round(stat.saves),
            shots: Math.round(stat.shots),
            demosInflicted: Math.round(stat.demosInflicted),
            demosTaken: Math.round(stat.demosTaken),
            mvp: stat.mvp,
            platform: stat.platform || null,
            onlineId: stat.onlineId || null,
            bpm: stat.bpm,
            avgBoostAmount: stat.avgBoostAmount,
            amountCollected: stat.amountCollected,
            amountCollectedBig: stat.amountCollectedBig,
            amountCollectedSmall: stat.amountCollectedSmall,
            countCollectedBig: stat.countCollectedBig,
            countCollectedSmall: stat.countCollectedSmall,
            amountStolen: stat.amountStolen,
            amountStolenBig: stat.amountStolenBig,
            amountStolenSmall: stat.amountStolenSmall,
            countStolenBig: stat.countStolenBig,
            countStolenSmall: stat.countStolenSmall,
            timeZeroBoost: stat.timeZeroBoost,
            timeFullBoost: stat.timeFullBoost,
            amountUsedWhileSupersonic: stat.amountUsedWhileSupersonic,
            amountOverfill: stat.amountOverfill,
            amountOverfillStolen: stat.amountOverfillStolen,
            avgSpeed: stat.avgSpeed,
            totalDistance: stat.totalDistance,
            timeSlowSpeed: stat.timeSlowSpeed,
            timeBoostSpeed: stat.timeBoostSpeed,
            timeSupersonic: stat.timeSupersonic,
            timeOnGround: stat.timeOnGround,
            timeLowAir: stat.timeLowAir,
            timeHighAir: stat.timeHighAir,
            timePowerslide: stat.timePowerslide,
            countPowerslide: stat.countPowerslide,
            timeDefensiveThird: stat.timeDefensiveThird,
            timeNeutralThird: stat.timeNeutralThird,
            timeOffensiveThird: stat.timeOffensiveThird,
            timeDefensiveHalf: stat.timeDefensiveHalf,
            timeOffensiveHalf: stat.timeOffensiveHalf,
            timeBehindBall: stat.timeBehindBall,
            timeInFrontBall: stat.timeInFrontBall,
            avgDistanceToBall: stat.avgDistanceToBall,
            avgDistanceToBallHasPossession: stat.avgDistanceToBallHasPossession,
            avgDistanceToBallNoPossession: stat.avgDistanceToBallNoPossession,
            cameraFov: stat.cameraFov || null,
            cameraHeight: stat.cameraHeight || null,
            cameraAngle: stat.cameraAngle || null,
            cameraDistance: stat.cameraDistance || null,
            cameraStiffness: stat.cameraStiffness || null,
            cameraSwivel: stat.cameraSwivel || null,
          }
        });
      }
    });

    return { parsed: true, replayFileId, players: extracted.length };
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log("[worker] completed", job.id);
});

worker.on("failed", (job, err) => {
  console.error("[worker] failed", job?.id, err.message);
  const replayFileId = String(job?.data?.replayFileId || "").trim();
  if (replayFileId) {
    prisma.replayFile
      .update({
        where: { id: replayFileId },
        data: { parserStatus: ReplayParseStatus.failed, parserError: err.message }
      })
      .catch((e) => console.error("[worker] failed to write failure state", e.message));
  }
});

async function bootstrap() {
  console.log("[worker] started — advanced frame analysis enabled");
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
