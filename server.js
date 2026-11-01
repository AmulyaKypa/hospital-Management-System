const app = require('./app');
const env = require('./config/env');
const connectDB = require('./config/db');
const seed = require('./utils/seed');

connectDB()
  .then(seed)
  .then(() => app.listen(env.PORT, () => console.log(`HMS running on http://localhost:${env.PORT}`)));
