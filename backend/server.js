require('./utils/envLoader');
const app = require('./app');

const PORT = parseInt(process.env.PORT || '5001', 10);

app.locals.dbReady.finally(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
