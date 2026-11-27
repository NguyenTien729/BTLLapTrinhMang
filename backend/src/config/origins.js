module.exports = () => [...new Set([
  ...(process.env.CLIENT_ORIGIN || process.env.CLIENT_URL || '').split(',').map(value=>value.trim()).filter(Boolean),
  'http://localhost:5173', 'http://127.0.0.1:5173',
])];
