const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico');

(async () => {
  try {
    const cwd = process.cwd();
    const src = path.join(cwd, 'public', 'branding', 'favicon-256.png');
    const out = path.join(cwd, 'public', 'favicon.ico');

    if (!fs.existsSync(src)) {
      console.error(`Source file not found: ${src}`);
      process.exit(1);
    }

    const buf = await pngToIco(src);
    fs.writeFileSync(out, buf);
    console.log(`Wrote ${out}`);
  } catch (err) {
    console.error('Error generating favicon.ico:', err);
    process.exit(1);
  }
})();
