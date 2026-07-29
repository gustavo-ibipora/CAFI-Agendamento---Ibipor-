const test = require('node:test');
const assert = require('node:assert/strict');
const { validarCPF, validarAgendamentoEntrada, validarHorariosDisponiveis } = require('../validators/agendamentos');
const { validarLogin, validarCriacaoUsuario, validarAtualizacaoUsuario, validarId, validarHorariosAdmin, validarRelatorioAgendamentos } = require('../validators/admin');

const dominios = {
  ubs: ['UBS San Rafael'],
  tiposMedicamento: ['Antibiotico', 'Nao sei']
};

function agendamentoValido() {
  return {
    nome_completo: 'Teste Usuario',
    cpf: '529.982.247-25',
    data_nascimento: '1990-01-01',
    endereco: 'Rua Teste, 123',
    telefone: '43999999999',
    email: 'teste@example.com',
    ubs: 'UBS San Rafael',
    tipo_medicamento: 'Antibiotico',
    primeiro_atendimento: false,
    previsao_termino: '2026-07-20',
    observacoes: '',
    data_agendamento: '2026-07-15',
    horario: '08:00'
  };
}

test('valida CPF real e rejeita CPF invalido', () => {
  assert.equal(validarCPF('529.982.247-25'), true);
  assert.equal(validarCPF('111.111.111-11'), false);
});

test('valida payload de agendamento e normaliza CPF', () => {
  const resultado = validarAgendamentoEntrada(agendamentoValido(), dominios);

  assert.equal(resultado.ok, true);
  assert.equal(resultado.dados.cpf, '52998224725');
});

test('sanitiza texto de agendamento e rejeita campos inesperados', () => {
  const payload = {
    ...agendamentoValido(),
    nome_completo: '  Teste\u0000 Usuario  ',
    perfil: 'admin'
  };
  const resultado = validarAgendamentoEntrada(payload, dominios);

  assert.equal(resultado.ok, false);
  assert.match(resultado.mensagem, /Unrecognized key/);

  delete payload.perfil;
  const sanitizado = validarAgendamentoEntrada(payload, dominios);
  assert.equal(sanitizado.ok, true);
  assert.equal(sanitizado.dados.nome_completo, 'Teste Usuario');
});

test('rejeita data de nascimento futura, data passada e horario invalido', () => {
  const payload = {
    ...agendamentoValido(),
    data_nascimento: '2999-01-01',
    data_agendamento: '2000-01-01',
    horario: '07:00'
  };
  const resultado = validarAgendamentoEntrada(payload, dominios);

  assert.equal(resultado.ok, false);
  assert.match(resultado.mensagem, /Data de nascimento nao pode ser futura/);
  assert.match(resultado.mensagem, /A data do agendamento deve ser a partir do dia seguinte/);
  assert.match(resultado.mensagem, /Horario invalido/);
});

test('valida parametros de horarios disponiveis', () => {
  const resultado = validarHorariosDisponiveis({
    data: '2026-07-15',
    primeiroAtendimento: 'false'
  });

  assert.equal(resultado.ok, true);
});

test('valida login e bloqueia campos extras', () => {
  const resultado = validarLogin({
    usuario: ' admin\u0000 ',
    senha: 'SenhaForte@123'
  });

  assert.equal(resultado.ok, true);
  assert.equal(resultado.dados.usuario, 'admin');

  const invalido = validarLogin({
    usuario: 'admin',
    senha: 'SenhaForte@123',
    papel: 'superadmin'
  });
  assert.equal(invalido.ok, false);
});

test('valida criacao de usuario administrativo e bloqueia campos extras', () => {
  const resultado = validarCriacaoUsuario({
    nome: 'Operador Teste',
    usuario: 'operador',
    senha: 'SenhaForte@123',
    role: 'OPERADOR'
  });

  assert.equal(resultado.ok, true);
  assert.equal(resultado.dados.nome, 'Operador Teste');
  assert.equal(resultado.dados.role, 'OPERADOR');

  const invalido = validarCriacaoUsuario({
    nome: 'Operador Teste',
    usuario: 'operador',
    senha: 'SenhaForte@123',
    role: 'ADMIN',
    perfil: 'admin'
  });
  assert.equal(invalido.ok, false);
});

test('valida atualizacao de usuario administrativo com senha opcional', () => {
  const resultado = validarAtualizacaoUsuario({
    nome: 'Admin Teste',
    usuario: 'admin.teste',
    role: 'ADMIN',
    ativo: true,
    senha: ''
  });

  assert.equal(resultado.ok, true);
  assert.equal(resultado.dados.ativo, true);

  const invalido = validarAtualizacaoUsuario({
    nome: 'Admin Teste',
    usuario: 'admin.teste',
    role: 'GESTOR',
    ativo: true
  });
  assert.equal(invalido.ok, false);
});

test('valida identificadores e parametros administrativos de horarios', () => {
  assert.equal(validarId({ id: '42' }).dados.id, 42);
  assert.equal(validarId({ id: '1 OR 1=1' }).ok, false);

  const horarios = validarHorariosAdmin({
    data: '2026-07-15',
    primeiroAtendimento: 'true',
    agendamentoId: '10'
  });
  assert.equal(horarios.ok, true);
  assert.equal(horarios.dados.agendamentoId, 10);
});

test('valida filtros de relatorio de agendamentos', () => {
  const resultado = validarRelatorioAgendamentos({
    data_inicio: '2026-07-01',
    data_fim: '2026-07-31',
    ubs: 'UBS San Rafael',
    tipo_medicamento: 'Antibiotico',
    status: 'atendido'
  }, dominios);

  assert.equal(resultado.ok, true);

  const periodoInvertido = validarRelatorioAgendamentos({
    data_inicio: '2026-07-31',
    data_fim: '2026-07-01'
  }, dominios);
  assert.equal(periodoInvertido.ok, false);

  const dominioInvalido = validarRelatorioAgendamentos({
    ubs: 'UBS Fora da Lista'
  }, dominios);
  assert.equal(dominioInvalido.ok, false);
});
