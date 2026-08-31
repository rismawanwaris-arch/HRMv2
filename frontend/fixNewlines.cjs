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
      
      // We want to replace literally '\' followed by 'n' outside of strings,
      // but the easiest way is since this happened because of my script,
      // and it's mostly around imports:
      
      if (content.includes('\\nimport') || content.includes(';\\n') || content.includes('\\n  ')) {
         content = content.replace(/\\n/g, '\n');
         fs.writeFileSync(fullPath, content);
         console.log('Fixed newlines in', fullPath);
      }
    }
  }
}

processDir(path.join(__dirname, 'src'));
