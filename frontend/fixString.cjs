const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'src', 'views', 'CandidateDetail.jsx');
let content = fs.readFileSync(targetFile, 'utf8');

// The unterminated string is: alert('Tautan Ujian Online disalin ke clipboard:
// ' + link)
// We will replace it back to \n
content = content.replace(/alert\('Tautan Ujian Online disalin ke clipboard:\n' \+ link\)/g, "alert('Tautan Ujian Online disalin ke clipboard:\\n' + link)");

fs.writeFileSync(targetFile, content);
console.log('Fixed multiline string in CandidateDetail.jsx');
