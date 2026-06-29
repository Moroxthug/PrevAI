const fs = require('fs');
const path = require('path');

const ROOT_DIR = 'c:\\Users\\Admin\\Downloads\\PrevAI (2)\\PrevAI';
const EXCLUDE_DIRS = ['.git', 'node_modules', '.agents'];
const SEARCH_PATTERN = /preventivo-mobile/i;

const results = [];

function searchDir(dir) {
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err);
    return;
  }

  for (const file of files) {
    const fullPath = path.join(dir, file);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch (err) {
      console.error(`Error statting file ${fullPath}:`, err);
      continue;
    }

    if (stat.isDirectory()) {
      if (EXCLUDE_DIRS.includes(file)) {
        continue;
      }
      if (file.toLowerCase().includes('preventivo-mobile')) {
        results.push({ type: 'directory_name', path: fullPath });
      }
      searchDir(fullPath);
    } else {
      if (file.toLowerCase().includes('preventivo-mobile')) {
        results.push({ type: 'file_name', path: fullPath });
      }
      // Check content for text files
      const ext = path.extname(file).toLowerCase();
      const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.zip', '.mp4', '.mov', '.xlsx', '.bin'];
      if (!binaryExtensions.includes(ext)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (SEARCH_PATTERN.test(content)) {
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
              if (SEARCH_PATTERN.test(line)) {
                results.push({
                  type: 'content_match',
                  path: fullPath,
                  line: idx + 1,
                  text: line.trim()
                });
              }
            });
          }
        } catch (err) {
          // Skip if unable to read
        }
      }
    }
  }
}

searchDir(ROOT_DIR);

console.log('Search Results:');
console.log(JSON.stringify(results, null, 2));

const outputPath = path.join(__dirname, 'search_results.json');
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(`Results written to ${outputPath}`);
