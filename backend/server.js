const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment configuration
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('./config/db');

const app = express();

// Standard middleware
app.use(cors());
app.use(express.json());

// Initialize DB and determine mock mode
connectDB();

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/vendors', require('./routes/vendors'));
app.use('/api/pos', require('./routes/pos'));
app.use('/api/rules', require('./routes/rules'));
app.use('/api/audits', require('./routes/audits'));
app.use('/api/upload', require('./routes/upload'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.message);
  res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

// Serve frontend assets in production
const frontendBuildPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendBuildPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendBuildPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('<h1>AP Automation Backend API running.</h1><p>Frontend app not built yet. Run npm run build in frontend.</p>');
    }
  });
});

// Reload trigger
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`⚡ Express Server running on port ${PORT} (isMockDB: ${!!global.isMockDB})`);
});
