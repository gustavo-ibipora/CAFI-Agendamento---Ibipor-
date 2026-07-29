const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const mensagemPadrao = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';

function respostaRateLimit(req, res) {
  res.status(429).json({
    erro: mensagemPadrao,
    codigo: 'MUITAS_TENTATIVAS'
  });
}

const loginLimiter = rateLimit({
  windowMs: env.security.loginRateLimitWindowMs,
  max: env.security.loginRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: respostaRateLimit
});

const agendamentoLimiter = rateLimit({
  windowMs: env.security.agendamentoRateLimitWindowMs,
  max: env.security.agendamentoRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: respostaRateLimit
});

module.exports = {
  loginLimiter,
  agendamentoLimiter
};
