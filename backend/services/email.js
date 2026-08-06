const nodemailer = require('nodemailer');
const env = require('../config/env');
const logger = require('../utils/logger');

let transporte;

function smtpConfigurado() {
  return Boolean(env.smtp.host && env.smtp.user && env.smtp.pass);
}

function obterTransporte() {
  if (!transporte) {
    transporte = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: {
        user: env.smtp.user,
        pass: env.smtp.pass
      }
    });
  }

  return transporte;
}

function formatarDataAgendamento(valor) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    const dia = String(valor.getUTCDate()).padStart(2, '0');
    const mes = String(valor.getUTCMonth() + 1).padStart(2, '0');
    const ano = valor.getUTCFullYear();
    return `${dia}/${mes}/${ano}`;
  }

  const texto = String(valor || '');
  const dataIso = texto.slice(0, 10);
  const match = dataIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  const data = new Date(texto);
  if (!Number.isNaN(data.getTime())) {
    const dia = String(data.getUTCDate()).padStart(2, '0');
    const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
    const ano = data.getUTCFullYear();
    return `${dia}/${mes}/${ano}`;
  }

  return 'Nao informada';
}

function criarMensagemConfirmacao(agendamento) {
  const dataFormatada = formatarDataAgendamento(agendamento.data_agendamento);

  return {
    from: env.smtp.from,
    to: agendamento.email,
    subject: 'Confirmacao de agendamento - Farmácia Municipal',
    text:
      `Ola, ${agendamento.nome_completo}!\n\n` +
      `Seu agendamento na Farmácia Municipal foi confirmado:\n\n` +
      `Data: ${dataFormatada}\n` +
      `Horario: ${agendamento.horario}\n` +
      `UBS de origem: ${agendamento.ubs}\n` +
      `Medicamento: ${agendamento.tipo_medicamento}\n\n` +
      `Chegue com alguns minutos de antecedencia e traga um documento com foto.\n\n` +
      `Prefeitura Municipal de Ibipora-PR`
  };
}

async function enviarMensagem(mensagem, contexto = {}) {
  if (!smtpConfigurado()) {
    logger.warn('email.smtp_nao_configurado', contexto);
    return { enviado: false, motivo: 'SMTP_NAO_CONFIGURADO' };
  }

  try {
    await obterTransporte().sendMail(mensagem);
    return { enviado: true };
  } catch (err) {
    logger.error('email.envio_falhou', {
      ...contexto,
      mensagem: err.message
    });
    return { enviado: false, motivo: 'FALHA_ENVIO' };
  }
}

module.exports = {
  smtpConfigurado,
  criarMensagemConfirmacao,
  formatarDataAgendamento,
  enviarMensagem
};
