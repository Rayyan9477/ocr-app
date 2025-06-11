/**
 * This is a simple API server for development purposes.
 * It provides a standalone server-side environment to handle Node.js operations
 * that can't be performed in the Next.js client components.
 */
const express = require('express');
const { exec } = require('child_process');
const { promisify } = require('util');
const cors = require('cors');
const bodyParser = require('body-parser');

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Execute command endpoint
app.post('/api/exec', async (req, res) => {
  try {
    const { command } = req.body;
    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }
    
    console.log(`Executing command: ${command}`);
    const { stdout, stderr } = await execAsync(command);
    
    return res.json({
      success: true,
      stdout,
      stderr
    });
  } catch (error) {
    console.error('Error executing command:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
