const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const env = require('./config/env');
const sessionStore = require('./config/session-store');
const { loginLimiter } = require('./middleware/rate-limits');
const { errorHandler, notFoundHandler } = require('./middleware/error-handler');
const logger = require('./utils/logger');
const { iniciarWorkerEmail } = require('./services/email-queue');

const agendamentosRouter = require('./routes/agendamentos');
const adminRouter = require('./routes/admin');

const app = express();

const corsOptions = env.server.corsOrigin
  ? { origin: env.server.corsOrigin, credentials: true }
  : { origin: false };

app.set('trust proxy', env.server.nodeEnv === 'production' ? 1 : 0);
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors(corsOptions));
app.use(express.json({ limit: '50kb' }));
app.use(session({
  store: sessionStore,
  name: 'farmacia.sid',
  secret: env.session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: env.session.sameSite,
    secure: env.session.secureCookie,
    maxAge: 1000 * 60 * 60 * 8
  }
}));

app.use('/api/agendamentos', agendamentosRouter);
app.use('/api/admin/login', loginLimiter);
app.use('/api/admin', adminRouter);
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = env.server.port;
app.listen(PORT, () => {
  logger.info('servidor.iniciado', { url: `http://localhost:${PORT}` });
});

iniciarWorkerEmail(require('./db'));
