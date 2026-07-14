import fs from 'fs';
import path from 'path';

const src = path.resolve('dist/prevai-widget.js');
const dest = path.resolve('../preventivo-ai/public/widget.js');

try {
  // Assicurati che la cartella di destinazione esista
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  fs.copyFileSync(src, dest);
  console.log(`✓ Widget compiled script copied to: ${dest}`);
} catch (err) {
  console.error('Failed to copy widget compiled script:', err);
  process.exit(1);
}
