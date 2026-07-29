const test = require('node:test');
const assert = require('node:assert/strict');
const { criarMensagemConfirmacao, formatarDataAgendamento } = require('../services/email');

test('cria mensagem de confirmacao de email', () => {
  const mensagem = criarMensagemConfirmacao({
    id: 10,
    nome_completo: 'Teste Usuario',
    email: 'teste@example.com',
    data_agendamento: '2026-07-06',
    horario: '08:00',
    ubs: 'UBS San Rafael',
    tipo_medicamento: 'Antibiotico'
  });

  assert.equal(mensagem.to, 'teste@example.com');
  assert.match(mensagem.subject, /Confirmacao/);
  assert.match(mensagem.text, /Teste Usuario/);
  assert.match(mensagem.text, /06\/07\/2026/);
});

test('formata data de agendamento quando o banco retorna Date', () => {
  assert.equal(formatarDataAgendamento(new Date('2026-07-06T00:00:00.000Z')), '06/07/2026');
});
