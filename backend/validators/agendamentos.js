const { z } = require('zod');
const slots = require('../services/slots');
const { dataHojeISO, dataAmanhaISO, ehDataISO, ehDiaUtil, compararDatasISO } = require('../services/datas');

function validarCPF(cpfBruto) {
  const cpf = String(cpfBruto || '').replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const calcularDigito = (base) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * (base.length + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const digito1 = calcularDigito(cpf.slice(0, 9));
  const digito2 = calcularDigito(cpf.slice(0, 9) + digito1);
  return cpf === cpf.slice(0, 9) + String(digito1) + String(digito2);
}

function mensagemZod(error) {
  return error.issues.map((issue) => issue.message).join(' ');
}

function textoSeguro(valor) {
  return String(valor || '')
    .normalize('NFC')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
}

const textoObrigatorio = (rotulo, max) => z.string()
  .transform(textoSeguro)
  .pipe(z.string().min(1, `${rotulo} e obrigatorio.`).max(max, `${rotulo} deve ter no maximo ${max} caracteres.`));

const dataObrigatoria = (rotulo) => z.string()
  .refine(ehDataISO, `${rotulo} deve estar no formato YYYY-MM-DD.`);

const agendamentoSchema = z.object({
  nome_completo: textoObrigatorio('Nome completo', 150),
  cpf: z.string().transform((valor) => valor.replace(/\D/g, '')).refine(validarCPF, 'CPF invalido.'),
  data_nascimento: dataObrigatoria('Data de nascimento'),
  endereco: textoObrigatorio('Endereco', 255),
  telefone: z.string().transform(textoSeguro).pipe(z.string().min(1, 'Telefone e obrigatorio.').max(20, 'Telefone deve ter no maximo 20 caracteres.'))
    .refine((valor) => valor.replace(/\D/g, '').length >= 10, 'Telefone invalido.'),
  email: z.string().transform(textoSeguro).pipe(z.string().min(1, 'E-mail e obrigatorio.').max(150, 'E-mail deve ter no maximo 150 caracteres.').email('E-mail invalido.')),
  ubs: textoObrigatorio('Unidade Basica de Saude', 100),
  tipo_medicamento: textoObrigatorio('Tipo de medicamento', 80),
  primeiro_atendimento: z.preprocess((valor) => {
    if (valor === 'sim') return true;
    if (valor === 'nao') return false;
    return valor;
  }, z.boolean({ message: 'Informe se e o primeiro atendimento.' })),
  previsao_termino: dataObrigatoria('Previsao de termino'),
  observacoes: z.string().transform(textoSeguro).pipe(z.string().max(2000, 'Observacoes devem ter no maximo 2000 caracteres.')).optional().or(z.literal('')),
  data_agendamento: dataObrigatoria('Data do agendamento'),
  horario: z.string().regex(/^\d{2}:\d{2}$/, 'Horario deve estar no formato HH:mm.')
}).strict().superRefine((dados, ctx) => {
  const hoje = dataHojeISO();
  const amanha = dataAmanhaISO();

  if (compararDatasISO(dados.data_nascimento, hoje) > 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['data_nascimento'], message: 'Data de nascimento nao pode ser futura.' });
  }

  if (compararDatasISO(dados.previsao_termino, hoje) < 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['previsao_termino'], message: 'Previsao de termino nao pode ser no passado.' });
  }

  if (compararDatasISO(dados.data_agendamento, amanha) < 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['data_agendamento'], message: 'A data do agendamento deve ser a partir do dia seguinte.' });
  }

  if (!ehDiaUtil(dados.data_agendamento)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['data_agendamento'], message: 'A farmacia so atende de segunda a sexta.' });
  }

  if (!slots.horarioValido(dados.horario)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['horario'], message: 'Horario invalido.' });
  }
});

const horariosDisponiveisSchema = z.object({
  data: dataObrigatoria('Data'),
  primeiroAtendimento: z.enum(['true', 'false'], { message: 'Parametro "primeiroAtendimento" deve ser true ou false.' })
}).superRefine((dados, ctx) => {
  const hoje = dataHojeISO();
  const amanha = dataAmanhaISO();

  if (compararDatasISO(dados.data, amanha) < 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['data'], message: 'A data deve ser a partir do dia seguinte.' });
  }
});

function validarAgendamentoEntrada(body, dominios) {
  const resultado = agendamentoSchema.safeParse(body);
  if (!resultado.success) {
    return { ok: false, mensagem: mensagemZod(resultado.error), detalhes: resultado.error.issues.map((issue) => issue.message) };
  }
  const detalhes = [];
  if (dominios && !dominios.ubs.includes(resultado.data.ubs)) {
    detalhes.push('Unidade Basica de Saude invalida.');
  }
  if (dominios && !dominios.tiposMedicamento.includes(resultado.data.tipo_medicamento)) {
    detalhes.push('Tipo de medicamento invalido.');
  }
  if (detalhes.length > 0) {
    return { ok: false, mensagem: detalhes.join(' '), detalhes };
  }
  return { ok: true, dados: resultado.data };
}

function validarHorariosDisponiveis(query) {
  const resultado = horariosDisponiveisSchema.safeParse(query);
  if (!resultado.success) {
    return { ok: false, mensagem: mensagemZod(resultado.error), detalhes: resultado.error.issues.map((issue) => issue.message) };
  }
  return { ok: true, dados: resultado.data };
}

module.exports = {
  validarAgendamentoEntrada,
  validarHorariosDisponiveis,
  validarCPF
};
