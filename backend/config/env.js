const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

function obrigatoria(nome) {
  const valor = process.env[nome];
  if (valor === undefined || valor === '') {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${nome}`);
  }
  return valor;
}

function numero(nome, padrao) {
  const valor = process.env[nome] || String(padrao);
  const convertido = Number(valor);
  if (!Number.isInteger(convertido) || convertido <= 0) {
    throw new Error(`Variavel de ambiente invalida: ${nome} deve ser um numero inteiro positivo`);
  }
  return convertido;
}

function booleano(nome, padrao) {
  const valor = process.env[nome];
  if (valor === undefined || valor === '') return padrao;
  if (['true', '1', 'sim', 'yes'].includes(valor.toLowerCase())) return true;
  if (['false', '0', 'nao', 'no'].includes(valor.toLowerCase())) return false;
  throw new Error(`Variavel de ambiente invalida: ${nome} deve ser true ou false`);
}

function sessionSameSite() {
  const valor = (process.env.SESSION_COOKIE_SAMESITE || 'lax').toLowerCase();
  if (!['lax', 'strict', 'none'].includes(valor)) {
    throw new Error('Variavel de ambiente invalida: SESSION_COOKIE_SAMESITE deve ser lax, strict ou none');
  }
  return valor;
}

function validarSmtp() {
  const credenciais = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
  const preenchidos = credenciais.filter((campo) => Boolean(process.env[campo]));

  if (preenchidos.length > 0 && (preenchidos.length < credenciais.length || !process.env.SMTP_FROM)) {
    throw new Error('Configuracao SMTP incompleta. Preencha SMTP_HOST, SMTP_USER, SMTP_PASS e SMTP_FROM ou deixe SMTP_HOST, SMTP_USER e SMTP_PASS vazios.');
  }
}

validarSmtp();

const nodeEnv = process.env.NODE_ENV || 'development';
const sessionSecret = obrigatoria('SESSION_SECRET');
const sessionSecureCookie = booleano('SESSION_COOKIE_SECURE', nodeEnv === 'production');
const sessionCookieSameSite = sessionSameSite();
if (nodeEnv === 'production' && sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET deve ter pelo menos 32 caracteres em producao');
}
if (sessionCookieSameSite === 'none' && !sessionSecureCookie) {
  throw new Error('SESSION_COOKIE_SAMESITE=none exige SESSION_COOKIE_SECURE=true');
}

module.exports = {
  db: {
    host: obrigatoria('DB_HOST'),
    user: obrigatoria('DB_USER'),
    password: process.env.DB_PASSWORD || '',
    name: obrigatoria('DB_NAME'),
    port: numero('DB_PORT', 3306)
  },
  session: {
    secret: sessionSecret,
    secureCookie: sessionSecureCookie,
    sameSite: sessionCookieSameSite
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: numero('SMTP_PORT', 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || ''
  },
  server: {
    port: numero('PORT', 3000),
    nodeEnv,
    corsOrigin: process.env.CORS_ORIGIN || ''
  },
  security: {
    loginRateLimitWindowMs: numero('LOGIN_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    loginRateLimitMax: numero('LOGIN_RATE_LIMIT_MAX', 10),
    agendamentoRateLimitWindowMs: numero('AGENDAMENTO_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    agendamentoRateLimitMax: numero('AGENDAMENTO_RATE_LIMIT_MAX', 30)
  },
  email: {
    workerIntervalMs: numero('EMAIL_WORKER_INTERVAL_MS', 30 * 1000)
  }
};
