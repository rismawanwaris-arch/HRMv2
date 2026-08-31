const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'CandidateDetail.jsx');
let content = fs.readFileSync(targetFile, 'utf8');

// The marker where we inserted the new components
const startMarker = '        <div className="glass-panel eval-panel">\\n          {activeTab === 1';
const startIndex = content.indexOf(startMarker);

// Find the very last closing div of eval-panel
const endMarker = '          )}';
const endMarkerLastIndex = content.lastIndexOf(endMarker);

if (startIndex !== -1 && endMarkerLastIndex !== -1) {
  // We want to delete from the end of our new components block, up to the endMarkerLastIndex
  const newComponentsEnd = content.indexOf('</div>', startIndex); // Wait, this is wrong.
  
  // Actually, let's just find the first occurrence of '{/* TAB 1: SELEKSI ADMINISTRASI */}' 
  // and the last occurrence of '{/* TAB 8: ONBOARDING TRACKER */} ... </form>)}'
  
  const tab1Start = content.indexOf('{/* TAB 1: SELEKSI ADMINISTRASI */}');
  const tab8EndStr = '          )}';
  const tab8End = content.indexOf(tab8EndStr, content.lastIndexOf('/* TAB 8: ONBOARDING TRACKER */')) + tab8EndStr.length;
  
  if (tab1Start !== -1 && tab8End !== -1) {
    // Delete the old code
    content = content.substring(0, tab1Start) + content.substring(tab8End);
    fs.writeFileSync(targetFile, content);
    console.log('Fixed CandidateDetail.jsx');
  } else {
    console.log('Could not find markers');
  }
} else {
  console.log('Not found');
}
