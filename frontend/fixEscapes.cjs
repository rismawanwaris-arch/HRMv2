const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Fix \`
      content = content.replace(/\\\\`/g, '`');
      content = content.replace(/\\\`/g, '`');

      // Fix \${
      content = content.replace(/\\\\\$\\{/g, '${');
      content = content.replace(/\\\$\\{/g, '${');

      fs.writeFileSync(fullPath, content);
      console.log('Fixed', fullPath);
    }
  }
}

processDir(path.join(__dirname, 'src'));
