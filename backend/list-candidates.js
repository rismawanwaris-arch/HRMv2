const { query } = require('./db');

async function listCandidates() {
  try {
    const list = await query.all('SELECT id, name, access_code, current_stage, status FROM candidates');
    console.log('--- Existing Candidates in DB ---');
    if (list.length === 0) {
      console.log('No candidates found in the database.');
    } else {
      list.forEach(c => {
        console.log(`ID: ${c.id} | Name: ${c.name} | Code: ${c.access_code} | Stage: ${c.current_stage} | Status: ${c.status}`);
      });
    }
    console.log('---------------------------------');
    process.exit(0);
  } catch (error) {
    console.error('Error listing candidates:', error);
    process.exit(1);
  }
}

listCandidates();
