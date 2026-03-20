const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const cwd = process.cwd();
    const publicBranding = path.resolve(cwd, 'public', 'branding');
    const src = path.join(publicBranding, 'favicon.png');

    if (!fs.existsSync(src)) {
      console.error(`Source file not found: ${src}`);
      process.exit(1);
    }

    // include larger sizes for high-DPI displays and PWA use
    const sizes = [16, 32, 64, 128, 180, 256, 512, 1024];
    await Promise.all(sizes.map(async (s) => {
      const out = path.join(publicBranding, `favicon-${s}.png`);
      await sharp(src).resize(s, s, { fit: 'cover' }).png().toFile(out);
      console.log(`Wrote ${out}`);
    }));

    console.log('Favicons generated successfully.');
  } catch (err) {
    console.error('Error generating favicons:', err);
    process.exit(1);
  }
})();
