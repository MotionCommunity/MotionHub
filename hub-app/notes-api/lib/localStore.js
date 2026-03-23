const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_DIR = path.join(process.cwd(), 'data');

function dataDir() {
  const custom = process.env.NOTES_DATA_DIR && String(process.env.NOTES_DATA_DIR).trim();
  return custom ? path.resolve(custom) : DEFAULT_DIR;
}

async function ensureDir() {
  await fs.mkdir(dataDir(), { recursive: true });
}

function filePath(fileName) {
  return path.join(dataDir(), fileName);
}

async function readJson(fileName, fallback) {
  await ensureDir();
  const full = filePath(fileName);
  try {
    const raw = await fs.readFile(full, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err && err.code === 'ENOENT') return fallback;
    return fallback;
  }
}

async function writeJson(fileName, value) {
  await ensureDir();
  const full = filePath(fileName);
  const json = JSON.stringify(value, null, 2);
  await fs.writeFile(full, json, 'utf8');
}

module.exports = {
  readJson,
  writeJson,
  dataDir,
};

