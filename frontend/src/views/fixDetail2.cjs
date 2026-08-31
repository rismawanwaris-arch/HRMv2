const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'CandidateDetail.jsx');
let content = fs.readFileSync(targetFile, 'utf8');

// Replace literal "\n" strings with actual newlines
content = content.replace(/\\n          \{activeTab/g, '\n          {activeTab');
content = content.replace(/\\n        <\/div>/g, '\n        </div>');

// Remove from line 322 (after </div> of eval-panel) down to the end of the form
const startString = "        </div>\n              \n              {/* DOCUMENT UPLOAD & MANAGEMENT SECTION";
const startIdx = content.indexOf('              {/* DOCUMENT UPLOAD & MANAGEMENT SECTION');
const endString = "          )}\n\n        </div>\n      </div>\n    </div>\n  );\n}";
const endIdx = content.indexOf('          )}\n\n        </div>\n      </div>\n    </div>\n  );\n}');

if (startIdx !== -1 && endIdx !== -1) {
  content = content.substring(0, startIdx) + '      </div>\n    </div>\n  );\n}\n\nexport default CandidateDetail;\n';
  fs.writeFileSync(targetFile, content);
  console.log('Fixed correctly');
} else {
  console.log('Could not find markers', { startIdx, endIdx });
}
