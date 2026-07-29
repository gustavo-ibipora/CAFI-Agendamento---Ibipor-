const express = require('express');
const pool = require('../db');
const slots = require('../services/slots');
const { enfileirarConfirmacao } = require('../services/email-queue');
const { agendamentoLimiter } = require('../middleware/rate-limits');
const asyncHandler = require('../middleware/async-handler');
const AppError = require('../utils/app-error');
const logger = require('../utils/logger');
const { validarAgendamentoEntrada, validarHorariosDisponiveis, validarCPF } = require('../validators/agendamentos');
const { listarDominios } = require('../services/dominios');
const { buscarOuImportarPacientePorCpf } = require('../services/pacientes');
const { receberReceita, removerArquivoReceita } = require('../middleware/upload-receita');

const router = express.Router();

router.get('/opcoes', asyncHandler(async (req, res) => {
  res.json(await listarDominios(pool));
}));

router.get('/paciente/:cpf', asyncHandler(async (req, res) => {
  const cpf = String(req.params.cpf || '').replace(/\D/g, '');
  if (!validarCPF(cpf)) {
    throw new AppError(400, 'CPF invalido.', 'CPF_INVALIDO');
  }

  const paciente = await buscarOuImportarPacientePorCpf(pool, cpf);
  if (!paciente) {
    return res.status(404).json({ encontrado: false });
  }

  if (paciente.data_nascimento instanceof Date) {
    const ano = paciente.data_nascimento.getFullYear();
    const mes = String(paciente.data_nascimento.getMonth() + 1).padStart(2, '0');
    const dia = String(paciente.data_nascimento.getDate()).padStart(2, '0');
    paciente.data_nascimento = `${ano}-${mes}-${dia}`;
  } else {
    paciente.data_nascimento = String(paciente.data_nascimento).slice(0, 10);
  }

  res.json({ encontrado: true, paciente });
}));

router.get('/horarios-disponiveis', asyncHandler(async (req, res) => {
  const validacao = validarHorariosDisponiveis(req.query);
  if (!validacao.ok) {
    throw new AppError(400, validacao.mensagem, 'VALIDACAO_HORARIOS', validacao.detalhes);
  }

  const { data, primeiroAtendimento } = validacao.dados;
  if (!slots.ehDiaUtil(data)) {
    return res.json({ blocos: [] });
  }

  const blocos = await slots.horariosDisponiveis(pool, data, primeiroAtendimento === 'true');
  res.json({ blocos });
}));

router.post('/', agendamentoLimiter, receberReceita, asyncHandler(async (req, res) => {
  const dominios = await listarDominios(pool);
  const validacao = validarAgendamentoEntrada(req.body, dominios);
  if (!validacao.ok) {
    removerArquivoReceita(req.file);
    throw new AppError(400, validacao.mensagem, 'VALIDACAO_AGENDAMENTO', validacao.detalhes);
  }
  const body = { ...validacao.dados, receita_arquivo: req.file ? req.file.filename : null };

  try {
    const id = await slots.criarAgendamento(pool, body);
    const [rows] = await pool.query(
      `SELECT id, nome_completo, cpf, email, ubs, tipo_medicamento, primeiro_atendimento,
              data_agendamento, horario, observacoes
       FROM agendamentos
       WHERE id = ?`,
      [id]
    );
    const agendamento = rows[0];
    const resultadoEmail = await enfileirarConfirmacao(pool, agendamento);

    logger.info('agendamento.criado', {
      agendamentoId: agendamento.id,
      data: agendamento.data_agendamento,
      horario: agendamento.horario,
      ubs: agendamento.ubs,
      tipoMedicamento: agendamento.tipo_medicamento,
      primeiroAtendimento: Boolean(agendamento.primeiro_atendimento),
      receitaAnexada: Boolean(body.receita_arquivo),
      emailEnviado: Boolean(resultadoEmail.enviado),
      emailEnfileirado: Boolean(resultadoEmail.enfileirado)
    });

    res.status(201).json({ agendamento, email: resultadoEmail });
  } catch (err) {
    removerArquivoReceita(req.file);
    if (err.codigo) {
      throw new AppError(409, err.message, err.codigo);
    }
    throw err;
  }
}));

module.exports = router;
