const { query, initDb } = require('./db');

async function testSeeding() {
  console.log('--- Database Verification Script ---');
  try {
    await initDb();
    
    // Check tables list
    const tables = await query.all("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('Found tables in database:');
    tables.forEach(t => console.log(`- ${t.name}`));

    // Check questions count
    const qCount = await query.get('SELECT COUNT(*) as count FROM test_questions');
    console.log(`Questions count in test_questions table: ${qCount.count}`);

    const sampleQ = await query.all('SELECT subtest, COUNT(*) as count FROM test_questions GROUP BY subtest');
    console.log('Questions breakdown by subtest:');
    sampleQ.forEach(s => console.log(`- ${s.subtest}: ${s.count} questions`));

    console.log('--- Verification Complete: Successful ---');
    process.exit(0);
  } catch (error) {
    console.error('Database verification failed:', error);
    process.exit(1);
  }
}

testSeeding();
