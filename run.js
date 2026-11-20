const { spawn } = require('child_process');
const path = require('path');

console.log('--- Starting Recruitment Monitoring System ---');

// Start Backend
console.log('Launching Backend Server (Express)...');
const backend = spawn('npm', ['run', 'dev'], {
  cwd: path.join(__dirname, 'backend'),
  shell: true,
  stdio: 'inherit'
});

// Start Frontend
console.log('Launching Frontend Dev Server (Vite)...');
const frontend = spawn('npm', ['run', 'dev'], {
  cwd: path.join(__dirname, 'frontend'),
  shell: true,
  stdio: 'inherit'
});

// Handle termination signals safely without re-entrant process.exit inside 'exit'
let cleaned = false;
const stopChildren = () => {
  if (cleaned) return;
  cleaned = true;
  console.log('\nStopping servers...');
  try { backend.kill(); } catch {}
  try { frontend.kill(); } catch {}
};

const handleSignal = () => {
  stopChildren();
  process.exit(0);
};

process.on('SIGINT', handleSignal);
process.on('SIGTERM', handleSignal);
process.on('exit', stopChildren);
