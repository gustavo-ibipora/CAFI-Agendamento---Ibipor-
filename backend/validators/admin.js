const { z } = require('zod');
const { ehDataISO } = require('../services/datas');

function mensagemZod(error) {
  return error.issues.map((issue) => issue.message).join(' ');
}

function textoSeguro(valor) {
  return String(valor || '')
    .normalize('NFC')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
}

const textoCurto = (rotulo, max = 120) => z.string()
  .transform(textoSeguro)
  .pipe(z.string().min(1, `${rotulo} e obrigatorio.`).max(max, `${rotulo} deve ter no maximo ${max} caracteres.`));

const idParamSchema = z.object({
  id: z.coerce.number({ message: 'Identificador invalido.' }).int('Identificador invalido.').positive('Identificador invalido.')
});

const loginSchema = z.object({
  usuario: textoCurto('Usuario', 80),
  senha: z.string().min(1, 'Senha e obrigatoria.').max(200, 'Senha invalida.')
}).strict();

const alterarSenhaSchema = z.object({
  senhaAtual: z.string().min(1, 'Senha atual e obrigatoria.').max(200, 'Senha atual invalida.'),
  novaSenha: z.string().min(1, 'Nova senha e obrigatoria.').max(200, 'Nova senha invalida.')
}).strict();

const criarUsuarioSchema = z.object({
  nome: textoCurto('Nome', 100),
  usuario: textoCurto('Usuario', 60),
  senha: z.string().min(1, 'Senha e obrigatoria.').max(200, 'Senha invalida.'),
  role: z.enum(['ADMIN', 'OPERADOR'], { message: 'Perfil de usuario invalido.' })
}).strict();

const atualizarUsuarioSchema = z.object({
  nome: textoCurto('Nome', 100),
  usuario: textoCurto('Usuario', 60),
  role: z.enum(['ADMIN', 'OPERADOR'], { message: 'Perfil de usuario invalido.' }),
  ativo: z.boolean({ message: 'Status do usuario invalido.' }),
  senha: z.string().max(200, 'Senha invalida.').optional().or(z.literal(''))
}).strict();

const statusSchema = z.object({
  status: z.enum(['confirmado', 'cancelado', 'atendido', 'faltou', 'presente'], { message: 'Status invalido.' })
}).strict();

const filtrosAgendaSchema = z.object({
  data: z.string().refine(ehDataISO, 'Parametro "data" deve estar no formato YYYY-MM-DD.'),
  ubs: z.string().transform(textoSeguro).pipe(z.string().max(100, 'Unidade Basica de Saude deve ter no maximo 100 caracteres.')).optional(),
  tipo_medicamento: z.string().transform(textoSeguro).pipe(z.string().max(80, 'Tipo de medicamento deve ter no maximo 80 caracteres.')).optional(),
  busca: z.string().transform(textoSeguro).pipe(z.string().max(120, 'Busca deve ter no maximo 120 caracteres.')).optional(),
  status: z.enum(['confirmado', 'cancelado', 'atendido', 'faltou', 'presente'], { message: 'Status invalido.' }).optional()
});

const reagendamentoSchema = z.object({
  data_agendamento: z.string().refine(ehDataISO, 'Data do agendamento deve estar no formato YYYY-MM-DD.'),
  horario: z.string().regex(/^\d{2}:\d{2}$/, 'Horario deve estar no formato HH:mm.')
}).strict();

const bloqueioSchema = z.object({
  data_agendamento: z.string().refine(ehDataISO, 'Data do bloqueio deve estar no formato YYYY-MM-DD.'),
  horario: z.string().regex(/^\d{2}:\d{2}$/, 'Horario deve estar no formato HH:mm.'),
  motivo: z.string().transform(textoSeguro).pipe(z.string().max(255, 'Motivo deve ter no maximo 255 caracteres.')).optional().or(z.literal(''))
}).strict();

const buscaPacienteSchema = z.object({
  busca: z.string().transform(textoSeguro).pipe(z.string().min(2, 'Informe pelo menos 2 caracteres para buscar.').max(120, 'Busca deve ter no maximo 120 caracteres.'))
});

const horariosAdminSchema = z.object({
  data: z.string().refine(ehDataISO, 'Parametro "data" deve estar no formato YYYY-MM-DD.'),
  primeiroAtendimento: z.enum(['true', 'false'], { message: 'Parametro "primeiroAtendimento" deve ser true ou false.' }).optional().default('false'),
  agendamentoId: z.coerce.number({ message: 'Identificador do agendamento invalido.' }).int('Identificador do agendamento invalido.').positive('Identificador do agendamento invalido.').optional()
});

const logsAdminSchema = z.object({
  evento: z.string().transform(textoSeguro).pipe(z.string().max(80, 'Evento deve ter no maximo 80 caracteres.')).optional(),
  busca: z.string().transform(textoSeguro).pipe(z.string().max(120, 'Busca deve ter no maximo 120 caracteres.')).optional(),
  limite: z.coerce.number({ message: 'Limite invalido.' }).int('Limite invalido.').positive('Limite invalido.').max(300, 'Limite maximo de logs e 300.').optional()
});

const relatorioAgendamentosSchema = z.object({
  data_inicio: z.string().refine(ehDataISO, 'Data inicial deve estar no formato YYYY-MM-DD.').optional(),
  data_fim: z.string().refine(ehDataISO, 'Data final deve estar no formato YYYY-MM-DD.').optional(),
  ubs: z.string().transform(textoSeguro).pipe(z.string().max(100, 'Unidade Basica de Saude deve ter no maximo 100 caracteres.')).optional(),
  tipo_medicamento: z.string().transform(textoSeguro).pipe(z.string().max(80, 'Tipo de medicamento deve ter no maximo 80 caracteres.')).optional(),
  status: z.enum(['confirmado', 'cancelado', 'atendido', 'faltou', 'presente'], { message: 'Status invalido.' }).optional()
});

function resposta(resultado) {
  if (!resultado.success) {
    return { ok: false, mensagem: mensagemZod(resultado.error), detalhes: resultado.error.issues.map((issue) => issue.message) };
  }
  return { ok: true, dados: resultado.data };
}

function validarLogin(body) {
  return resposta(loginSchema.safeParse(body));
}

function validarAlteracaoSenha(body) {
  return resposta(alterarSenhaSchema.safeParse(body));
}

function validarCriacaoUsuario(body) {
  return resposta(criarUsuarioSchema.safeParse(body));
}

function validarAtualizacaoUsuario(body) {
  return resposta(atualizarUsuarioSchema.safeParse(body));
}

function validarId(params) {
  return resposta(idParamSchema.safeParse(params));
}

function validarStatus(body) {
  return resposta(statusSchema.safeParse(body));
}

function validarFiltrosAgenda(query, dominios) {
  const resultado = filtrosAgendaSchema.safeParse(query);
  if (!resultado.success) {
    return { ok: false, mensagem: mensagemZod(resultado.error), detalhes: resultado.error.issues.map((issue) => issue.message) };
  }
  const detalhes = [];
  if (resultado.data.ubs && dominios && !dominios.ubs.includes(resultado.data.ubs)) {
    detalhes.push('Unidade Basica de Saude invalida.');
  }
  if (resultado.data.tipo_medicamento && dominios && !dominios.tiposMedicamento.includes(resultado.data.tipo_medicamento)) {
    detalhes.push('Tipo de medicamento invalido.');
  }
  if (detalhes.length > 0) {
    return { ok: false, mensagem: detalhes.join(' '), detalhes };
  }
  return { ok: true, dados: resultado.data };
}

function validarReagendamento(body) {
  return resposta(reagendamentoSchema.safeParse(body));
}

function validarBloqueio(body) {
  return resposta(bloqueioSchema.safeParse(body));
}

function validarBuscaPaciente(query) {
  return resposta(buscaPacienteSchema.safeParse(query));
}

function validarHorariosAdmin(query) {
  return resposta(horariosAdminSchema.safeParse(query));
}

function validarLogsAdmin(query) {
  return resposta(logsAdminSchema.safeParse(query));
}

function validarRelatorioAgendamentos(query, dominios) {
  const resultado = relatorioAgendamentosSchema.safeParse(query);
  if (!resultado.success) {
    return { ok: false, mensagem: mensagemZod(resultado.error), detalhes: resultado.error.issues.map((issue) => issue.message) };
  }

  const detalhes = [];
  const dados = resultado.data;
  if (dados.data_inicio && dados.data_fim && dados.data_inicio > dados.data_fim) {
    detalhes.push('Data inicial nao pode ser maior que a data final.');
  }
  if (dados.ubs && dominios && !dominios.ubs.includes(dados.ubs)) {
    detalhes.push('Unidade Basica de Saude invalida.');
  }
  if (dados.tipo_medicamento && dominios && !dominios.tiposMedicamento.includes(dados.tipo_medicamento)) {
    detalhes.push('Tipo de medicamento invalido.');
  }
  if (detalhes.length > 0) {
    return { ok: false, mensagem: detalhes.join(' '), detalhes };
  }
  return { ok: true, dados };
}

module.exports = {
  validarLogin,
  validarAlteracaoSenha,
  validarCriacaoUsuario,
  validarAtualizacaoUsuario,
  validarId,
  validarStatus,
  validarFiltrosAgenda,
  validarReagendamento,
  validarBloqueio,
  validarBuscaPaciente,
  validarHorariosAdmin,
  validarLogsAdmin,
  validarRelatorioAgendamentos
};
