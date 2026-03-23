import { spawn } from "node:child_process";

export interface ReplayParseOptions {
  parserPath: string;
  replayFilePath: string;
  headerOnly?: boolean;
}

export function parseReplay(options: ReplayParseOptions): Promise<unknown> {
  const { parserPath, replayFilePath, headerOnly } = options;
  const args = [replayFilePath];
  if (headerOnly) args.push("--header-only");

  return new Promise((resolve, reject) => {
    const proc = spawn(parserPath, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";

    proc.stdout.setEncoding("utf8");
    proc.stderr.setEncoding("utf8");

    proc.stdout.on("data", (chunk) => (stdout += chunk));
    proc.stderr.on("data", (chunk) => (stderr += chunk));
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
