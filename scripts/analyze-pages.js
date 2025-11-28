const fs = require('fs');
const path = require('path');

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      if (file === 'page.tsx') {
        arrayOfFiles.push(path.join(dirPath, "/", file));
      }
    }
  });

  return arrayOfFiles;
}

const pages = getAllFiles('app');

const results = pages.map(file => {
  const content = fs.readFileSync(file, 'utf8');
  const stats = fs.statSync(file);
  const lineCount = content.split('\n').length;
  const importCount = (content.match(/import /g) || []).length;
  
  return {
    file: file.replace(/\\/g, '/'),
    size: (stats.size / 1024).toFixed(2) + ' KB',
    lines: lineCount,
    imports: importCount
  };
});

// Sort by line count descending
results.sort((a, b) => b.lines - a.lines);

console.log('Page Analysis Report');
console.log('====================');
console.table(results);