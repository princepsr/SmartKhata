const fs = require('fs');
const path = require('path');

module.exports = async function(context) {
  const electronPlatformName = context.electronPlatformName;
  const appOutDir = context.appOutDir;

  console.log(`[CLEANUP] Starting cleanup in: ${appOutDir}`);

  if (electronPlatformName === 'win32') {
    // 1. Remove unnecessary locales
    const localesDir = path.join(appOutDir, 'locales');
    if (fs.existsSync(localesDir)) {
      const files = fs.readdirSync(localesDir);
      const keepLocales = ['en-US.pak', 'en-GB.pak'];
      for (const file of files) {
        if (file.endsWith('.pak') && !keepLocales.includes(file)) {
          fs.unlinkSync(path.join(localesDir, file));
        }
      }
      console.log(`[CLEANUP] Removed ${files.length - keepLocales.length} locale files.`);
    }

    // 2. Remove other junk from win-unpacked root if any
    const junkFiles = ['LICENSE.electron.txt', 'LICENSES.chromium.html'];
    for (const file of junkFiles) {
      const filePath = path.join(appOutDir, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[CLEANUP] Removed junk file: ${file}`);
      }
    }
  }
};
