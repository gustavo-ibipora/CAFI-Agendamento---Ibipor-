const AppError = require('../utils/app-error');
const logger = require('../utils/logger');

function respostaErro(err) {
  if (err instanceof AppError || err.isOperational) {
    return {
      status: err.status || 500,
      body: {
        erro: err.message,
        codigo: err.code || 'ERRO_APLICACAO',
        ...(err.details ? { detalhes: err.details } : {})
      }
    };
  }

  return {
    status: 500,
    body: {
      erro: 'Erro interno do servidor.',
      codigo: 'ERRO_INTERNO'
    }
  };
}

function notFoundHandler(req, res) {
  res.status(404).json({
    erro: 'Rota nao encontrada.',
    codigo: 'ROTA_NAO_ENCONTRADA'
  });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const { status, body } = respostaErro(err);

  logger.error('api.erro', {
    metodo: req.method,
    rota: req.originalUrl,
    status,
    codigo: body.codigo,
    mensagem: err.message,
    stack: err.stack
  });

  res.status(status).json(body);
}

module.exports = {
  errorHandler,
  notFoundHandler
};
