require('./utils/envLoader');
const app = require('./app');

const PORT = parseInt(process.env.PORT || '5002', 10);

app.locals.dbReady
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Fatal DB init error:', err);
    process.exit(1);
  });
