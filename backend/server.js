const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db');

const app = express();
const PORT = parseInt(process.env.PORT || '5001', 10);

app.use(cors());
app.use(express.json());

// Initialize Database
initDb().then(() => {
  console.log('Database initialized successfully.');
}).catch(err => {
  console.error('Failed to initialize database:', err);
});



// --- API ENDPOINTS ---

const { authenticateToken } = require('./middleware/auth');

const authRoutes = require('./routes/authRoutes');
app.use('/api', authRoutes);

const dashboardRoutes = require('./routes/dashboardRoutes');
app.use('/api/dashboard', authenticateToken, dashboardRoutes);



const employeeRoutes = require('./routes/employeeRoutes');
app.use('/api/employees', authenticateToken, employeeRoutes);


const candidateRoutes = require('./routes/candidateRoutes');
app.use('/api/candidates', authenticateToken, candidateRoutes);

const stageRoutes = require('./routes/stageRoutes');
app.use('/api/stages', authenticateToken, stageRoutes);

const branchRoutes = require('./routes/branchRoutes');
app.use('/api/branches', authenticateToken, branchRoutes);

const testRoutes = require('./routes/testRoutes');
app.use('/api', testRoutes);

// --- SERVE FRONTEND STATIC FILES IN PRODUCTION ---
const frontendBuildPath = path.join(__dirname, '..', 'frontend', 'dist');

// Serve static files from the React build
app.use(express.static(frontendBuildPath));

// SPA fallback: any non-API route serves the React app
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
