const { createApp } = require('./app');

const PORT = process.env.PORT || 4000;

createApp()
  .then((app) => app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`)))
  .catch((err) => { console.error('Failed to start:', err); process.exit(1); });
