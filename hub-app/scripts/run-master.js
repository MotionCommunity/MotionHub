/**
 * Run the hub in master mode: temporarily set build-type to 'master', launch Electron, then restore.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const hubAppDir = path.join(__dirname, '..');
const buildTypePath = path.join(hubAppDir, 'build-type.js');
const backupPath = path.join(hubAppDir, 'build-type.js.bak');

const STAFF_CONTENT = "// Set to 'master' when building the Master/Admin hub only. Staff hub uses 'staff' — staff cannot archive or delete tournaments.\nwindow.MOTION_HUB_BUILD = 'staff';\n";
const MASTER_CONTENT = "// Set to 'master' when building the Master/Admin hub only. Staff hub uses 'staff' — staff cannot archive or delete tournaments.\nwindow.MOTION_HUB_BUILD = 'master';\n";

try {
  fs.writeFileSync(backupPath, fs.readFileSync(buildTypePath));
  fs.writeFileSync(buildTypePath, MASTER_CONTENT);
  const result = spawnSync('npx', ['electron', '.'], { cwd: hubAppDir, stdio: 'inherit', shell: true });
  fs.writeFileSync(buildTypePath, STAFF_CONTENT);
  fs.unlinkSync(backupPath);
  process.exit(result.status || 0);
} catch (e) {
  if (fs.existsSync(backupPath)) {
    try { fs.copyFileSync(backupPath, buildTypePath); fs.unlinkSync(backupPath); } catch (_) {}
  }
  console.error(e);
  process.exit(1);
}
