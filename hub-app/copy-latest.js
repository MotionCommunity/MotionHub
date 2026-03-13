// Copies the built portable exe to Motion-Staff-Hub-LATEST.exe for Google Drive upload.
// Run after: npm run build
const fs = require('fs');
const path = require('path');
const pkg = require('./package.json');
const version = pkg.version;
const dist = path.join(__dirname, 'dist');
const src = path.join(dist, `Motion-Staff-Hub-${version}.exe`);
const dest = path.join(dist, 'Motion-Staff-Hub-LATEST.exe');

if (!fs.existsSync(src)) {
  console.error('Build not found. Run: npm run build');
  process.exit(1);
}
fs.copyFileSync(src, dest);
console.log('Copied to dist/Motion-Staff-Hub-LATEST.exe (ready for Drive upload)');
