/**
 * Replay parser using boxcars (Rust) for Rocket League .replay files.
 * Uses the motion-replay-parse binary (hub-app/replay-parser-boxcars) which uses the boxcars crate
 * to output full replay JSON (header + network data: goals, demolitions, frames, etc.).
 *
 * Build the parser: cd hub-app/replay-parser-boxcars && cargo build --release
 * Optional: set replayParserPath in hub config to a custom boxcars-based executable.
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const BINARY_NAME = process.platform === 'win32' ? 'motion_replay_parse.exe' : 'motion_replay_parse';

/**
 * Resolve the replay parser executable path.
 * 1. Config replayParserPath (absolute or PATH name)
 * 2. Bundled: replay-parser-boxcars/target/release/motion_replay_parse[.exe]
 * @param {string} appDir - __dirname of main process (hub-app)
 * @param {string|null} configPath - From loadConfig().replayParserPath
 * @returns {string|null} Path to executable or null if not found
 */
function getParserPath(appDir, configPath) {
  if (configPath && typeof configPath === 'string') {
    const trimmed = configPath.trim();
    if (trimmed) {
      if (path.isAbsolute(trimmed) && fs.existsSync(trimmed)) return trimmed;
      return trimmed; // allow "rrrocket" or other PATH name
    }
  }
  const bundled = path.join(appDir, 'replay-parser-boxcars', 'target', 'release', BINARY_NAME);
  if (fs.existsSync(bundled)) return bundled;
  return null;
}

/**
 * Parse a .replay file and return the full boxcars JSON object.
 * @param {string} replayFilePath - Absolute path to .replay file
 * @param {Object} options - { headerOnly: boolean, parserPath: string|null, appDir: string }
 * @returns {Promise<Object>} Parsed replay (header + network_frames etc.)
 */
function parseReplayFile(replayFilePath, options = {}) {
  const { headerOnly = false, parserPath = null, appDir = __dirname } = options;
  return new Promise((resolve, reject) => {
    if (!replayFilePath || !fs.existsSync(replayFilePath)) {
      reject(new Error('Replay file not found: ' + replayFilePath));
      return;
    }
    const exe = parserPath || getParserPath(appDir, null);
    if (!exe) {
      reject(
        new Error(
          'Boxcars replay parser not found. Build it: cd hub-app/replay-parser-boxcars && cargo build --release. Or set replayParserPath in Settings.'
        )
      );
      return;
    }
    const args = [replayFilePath];
    if (headerOnly) args.push('--header-only');
    const proc = spawn(exe, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.setEncoding('utf8');
    proc.stderr.setEncoding('utf8');
    proc.stdout.on('data', (chunk) => (stdout += chunk));
    proc.stderr.on('data', (chunk) => (stderr += chunk));
    proc.on('error', (err) => reject(err));
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Parser exited with code ${code}`));
        return;
      }
      try {
        const data = JSON.parse(stdout);
        resolve(data);
      } catch (e) {
        reject(new Error('Parser output was not valid JSON: ' + (e.message || e)));
      }
    });
  });
}

module.exports = { parseReplayFile, getParserPath, BINARY_NAME };
