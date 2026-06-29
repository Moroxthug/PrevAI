const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../..');
const outputFilePath = path.join(__dirname, 'search_results.txt');
fs.writeFileSync(outputFilePath, ''); // Clear file

const excludeDirs = ['.git', 'node_modules', '.agents', 'dist', 'attached_assets', '.local'];
const excludeFiles = ['pnpm-lock.yaml'];

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (excludeDirs.includes(file)) continue;
      searchDir(fullPath);
    } else {
      if (excludeFiles.includes(file)) continue;
      // Search file
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('preventivo-mobile')) {
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            if (line.includes('preventivo-mobile')) {
              const relPath = path.relative(rootDir, fullPath);
              const output = `${relPath}:${idx + 1}: ${line.trim()}\n`;
              console.log(output.trim());
              fs.appendFileSync(outputFilePath, output);
            }
          });
        }
      } catch (err) {
        // Skip binary or unreadable files
      }
    }
  }
}

searchDir(rootDir);
console.log('Done searching.');
