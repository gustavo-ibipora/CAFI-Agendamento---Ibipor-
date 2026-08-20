const env = require('../config/env');
const logger = require('../utils/logger');
const { smtpConfigurado, criarMensagemConfirmacao, enviarMensagem } = require('./email');

const STATUS_PENDENTE = 'pendente';
const STATUS_PROCESSANDO = 'processando';
const STATUS_ENVIADO = 'enviado';
const STATUS_FALHA = 'falha';

async function enfileirarConfirmacao(pool, agendamento) {
  if (!agendamento.email) {
    return { enviado: false, enfileirado: false, motivo: 'EMAIL_NAO_INFORMADO' };
  }

  if (!smtpConfigurado()) {
    logger.warn('email.smtp_nao_configurado', {
      agendamentoId: agendamento.id,
      email: agendamento.email
    });
    return { enviado: false, enfileirado: false, motivo: 'SMTP_NAO_CONFIGURADO' };
  }

  const mensagem = criarMensagemConfirmacao(agendamento);
  const [result] = await pool.query(
    `INSERT INTO email_jobs (tipo, destinatario, assunto, payload, status, tentativas, proxima_tentativa)
     VALUES ('confirmacao_agendamento', ?, ?, ?, ?, 0, NOW())`,
    [mensagem.to, mensagem.subject, JSON.stringify({ mensagem, agendamentoId: agendamento.id }), STATUS_PENDENTE]
  );

  logger.info('email.enfileirado', {
    emailJobId: result.insertId,
    agendamentoId: agendamento.id,
    email: agendamento.email
  });

  return { enviado: false, enfileirado: true, motivo: 'ENFILEIRADO', jobId: result.insertId };
}

async function buscarJob(pool) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT id, tipo, destinatario, assunto, payload, tentativas
       FROM email_jobs
       WHERE status IN (?, ?) AND proxima_tentativa <= NOW() AND tentativas < 5
       ORDER BY id
       LIMIT 1
       FOR UPDATE`,
      [STATUS_PENDENTE, STATUS_FALHA]
    );

    const job = rows[0];
    if (!job) {
      await conn.commit();
      return null;
    }

    await conn.query(
      'UPDATE email_jobs SET status = ?, tentativas = tentativas + 1, ultimo_erro = NULL WHERE id = ?',
      [STATUS_PROCESSANDO, job.id]
    );

    await conn.commit();
    return job;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function marcarEnviado(pool, jobId) {
  await pool.query(
    'UPDATE email_jobs SET status = ?, enviado_em = NOW(), proxima_tentativa = NULL WHERE id = ?',
    [STATUS_ENVIADO, jobId]
  );
}

async function marcarFalha(pool, jobId, erro) {
  await pool.query(
    `UPDATE email_jobs
     SET status = ?,
         ultimo_erro = ?,
         proxima_tentativa = DATE_ADD(NOW(), INTERVAL LEAST(tentativas * 5, 60) MINUTE)
     WHERE id = ?`,
    [STATUS_FALHA, String(erro || '').slice(0, 500), jobId]
  );
}

async function processarFilaEmail(pool) {
  if (!smtpConfigurado()) return { processado: false, motivo: 'SMTP_NAO_CONFIGURADO' };

  const job = await buscarJob(pool);
  if (!job) return { processado: false, motivo: 'SEM_JOBS' };

  try {
    const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
    const resultado = await enviarMensagem(payload.mensagem, {
      emailJobId: job.id,
      agendamentoId: payload.agendamentoId,
      email: job.destinatario
    });

    if (!resultado.enviado) {
      await marcarFalha(pool, job.id, resultado.motivo);
      return { processado: true, enviado: false, motivo: resultado.motivo };
    }

    await marcarEnviado(pool, job.id);
    logger.info('email.enviado', {
      emailJobId: job.id,
      agendamentoId: payload.agendamentoId,
      email: job.destinatario
    });
    return { processado: true, enviado: true };
  } catch (err) {
    await marcarFalha(pool, job.id, err.message);
    logger.error('email.job_falhou', {
      emailJobId: job.id,
      email: job.destinatario,
      mensagem: err.message
    });
    return { processado: true, enviado: false, motivo: 'FALHA_JOB' };
  }
}

function iniciarWorkerEmail(pool) {
  if (!smtpConfigurado()) {
    logger.warn('email.worker_desativado', { motivo: 'SMTP_NAO_CONFIGURADO' });
    return null;
  }

  const intervalo = setInterval(() => {
    processarFilaEmail(pool).catch((err) => {
      logger.error('email.worker_erro', { mensagem: err.message });
    });
  }, env.email.workerIntervalMs);

  intervalo.unref();
  logger.info('email.worker_iniciado', { intervaloMs: env.email.workerIntervalMs });
  return intervalo;
}

module.exports = {
  enfileirarConfirmacao,
  processarFilaEmail,
  iniciarWorkerEmail
};
