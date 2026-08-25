const test = require('node:test');
const assert = require('node:assert/strict');
const slots = require('../services/slots');

function respostaDiaNaoBloqueado(sql) {
  if (!sql.includes('dias_bloqueados')) return undefined;
  if (sql.includes('CREATE TABLE')) return [{}];
  return [[]];
}

function criarPoolMock(conn) {
  return {
    async query(sql) {
      const resposta = respostaDiaNaoBloqueado(sql);
      if (resposta) return resposta;
      throw new Error(`SQL inesperado no pool: ${sql}`);
    },
    async getConnection() {
      return conn;
    }
  };
}

const dadosBase = {
  nome_completo: 'Teste Usuario',
  cpf: '52998224725',
  data_nascimento: '1990-01-01',
  endereco: 'Rua Teste, 123',
  telefone: '43999999999',
  email: 'teste@example.com',
  ubs: 'UBS San Rafael',
  tipo_medicamento: 'Medicamento Controlado',
  primeiro_atendimento: false,
  previsao_termino: '2026-07-10',
  observacoes: '',
  data_agendamento: '2026-07-06',
  horario: '08:00'
};

test('gera blocos de 15 minutos cobrindo o dia inteiro', () => {
  const blocos = slots.gerarBlocosDia();

  assert.equal(blocos[0], '08:00');
  assert.equal(blocos.at(-1), '16:15');
  assert.equal(blocos.includes('09:45'), true);
  assert.equal(blocos.includes('13:00'), true);
  assert.equal(blocos.includes('15:00'), true);
});

test('bloqueia finais de semana', () => {
  assert.equal(slots.ehDiaUtil('2026-07-04'), false);
  assert.equal(slots.ehDiaUtil('2026-07-06'), true);
});

test('calcula disponibilidade por capacidade do slot', async () => {
  const pool = {
    async query(sql) {
      const resposta = respostaDiaNaoBloqueado(sql);
      if (resposta) return resposta;
      if (sql.includes('INSERT IGNORE INTO slots_agenda')) return [{}];
      if (sql.includes('SELECT horario, capacidade, ocupadas')) {
        return [[
          { horario: '08:00:00', capacidade: 8, ocupadas: 7 },
          { horario: '08:15:00', capacidade: 8, ocupadas: 8 }
        ]];
      }
      throw new Error(`SQL inesperado: ${sql}`);
    }
  };

  const resultado = await slots.horariosDisponiveis(pool, '2026-07-06', false);

  assert.deepEqual(resultado, [
    { horario: '08:00', vagasRestantes: 1, disponivel: true },
    { horario: '08:15', vagasRestantes: 0, disponivel: false }
  ]);
});

test('bloqueia limite diario de antibiotico na criacao', async () => {
  const conn = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {
      this.rollbackChamado = true;
    },
    release() {},
    async query(sql) {
      if (sql.includes('INSERT IGNORE INTO slots_agenda')) return [{}];
      if (sql.includes('CREATE TABLE IF NOT EXISTS contadores_diarios')) return [{}];
      if (sql.includes('INSERT IGNORE INTO contadores_diarios')) return [{}];
      if (sql.includes('UPDATE contadores_diarios')) return [{ affectedRows: 0 }];
      if (sql.includes('INSERT INTO pacientes')) return [{}];
      if (sql.includes('UPDATE slots_agenda')) return [{ affectedRows: 1 }];
      if (sql.includes('WHERE cpf = ? AND data_agendamento = ?')) return [[{ total: 0 }]];
      if (sql.includes("tipo_medicamento = 'Antibiotico'")) return [[{ total: slots.LIMITE_ATB_DIA }]];
      throw new Error(`SQL inesperado: ${sql}`);
    }
  };
  const pool = criarPoolMock(conn);

  await assert.rejects(
    () => slots.criarAgendamento(pool, { ...dadosBase, tipo_medicamento: 'Antibiotico' }),
    /limite diario/
  );
  assert.equal(conn.rollbackChamado, true);
});

test('encaixe ignora a lotacao do horario mas respeita horario bloqueado', async () => {
  let capacidadeQuery = null;
  const conn = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql) {
      if (sql.includes('INSERT IGNORE INTO slots_agenda')) return [{}];
      if (sql.includes('CREATE TABLE IF NOT EXISTS contadores_diarios')) return [{}];
      if (sql.includes('INSERT INTO pacientes')) return [{}];
      if (sql.includes('WHERE cpf = ? AND data_agendamento = ?')) return [[{ total: 0 }]];
      if (sql.includes('ocupadas + ? <= capacidade')) return [{ affectedRows: 0 }]; // variante sem encaixe: horario cheio
      if (sql.includes('SET capacidade = GREATEST')) {
        capacidadeQuery = sql;
        return [{ affectedRows: 1 }]; // variante encaixe: sempre ocupa, capacidade e elevada se preciso
      }
      if (sql.includes('INSERT INTO agendamentos')) return [{ insertId: 321 }];
      throw new Error(`SQL inesperado: ${sql}`);
    }
  };
  const pool = criarPoolMock(conn);

  const id = await slots.criarAgendamento(pool, dadosBase, { encaixe: true, adminId: 7 });

  assert.equal(id, 321);
  assert.ok(capacidadeQuery, 'deveria usar a query de encaixe (GREATEST) e nao a query normal');
});

test('encaixe e bloqueado quando o horario foi bloqueado pelo admin', async () => {
  const conn = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {
      this.rollbackChamado = true;
    },
    release() {},
    async query(sql) {
      if (sql.includes('INSERT IGNORE INTO slots_agenda')) return [{}];
      if (sql.includes('CREATE TABLE IF NOT EXISTS contadores_diarios')) return [{}];
      if (sql.includes('INSERT INTO pacientes')) return [{}];
      if (sql.includes('WHERE cpf = ? AND data_agendamento = ?')) return [[{ total: 0 }]];
      if (sql.includes('SET capacidade = GREATEST')) return [{ affectedRows: 0 }]; // capacidade = 0 -> bloqueado
      throw new Error(`SQL inesperado: ${sql}`);
    }
  };
  const pool = criarPoolMock(conn);

  await assert.rejects(
    () => slots.criarAgendamento(pool, dadosBase, { encaixe: true }),
    /bloqueado/
  );
  assert.equal(conn.rollbackChamado, true);
});

test('encaixe ignora o limite diario de antibiotico', async () => {
  const conn = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql) {
      if (sql.includes('INSERT IGNORE INTO slots_agenda')) return [{}];
      if (sql.includes('CREATE TABLE IF NOT EXISTS contadores_diarios')) return [{}];
      if (sql.includes('INSERT IGNORE INTO contadores_diarios')) return [{}];
      if (sql.includes('INSERT INTO pacientes')) return [{}];
      if (sql.includes('SET capacidade = GREATEST')) return [{ affectedRows: 1 }];
      if (sql.includes('WHERE cpf = ? AND data_agendamento = ?')) return [[{ total: 0 }]];
      if (sql.includes("UPDATE contadores_diarios") && sql.includes('AND valor < ?')) return [{ affectedRows: 0 }]; // variante sem encaixe: limite atingido
      if (sql.includes('UPDATE contadores_diarios')) return [{ affectedRows: 1 }]; // variante encaixe: sem limite
      if (sql.includes('INSERT INTO agendamentos')) return [{ insertId: 501 }];
      throw new Error(`SQL inesperado: ${sql}`);
    }
  };
  const pool = criarPoolMock(conn);

  const id = await slots.criarAgendamento(pool, { ...dadosBase, tipo_medicamento: 'Antibiotico' }, { encaixe: true });

  assert.equal(id, 501);
});

function agendamentoBanco(sobrescritas = {}) {
  return {
    id: 42,
    nome_completo: 'Teste Usuario',
    cpf: '52998224725',
    data_nascimento: '1990-01-01',
    endereco: 'Rua Teste, 123',
    telefone: '43999999999',
    email: 'teste@example.com',
    ubs: 'UBS San Rafael',
    tipo_medicamento: 'Medicamento Controlado',
    primeiro_atendimento: 0,
    previsao_termino: '2026-07-10',
    observacoes: null,
    receita_arquivo: null,
    data_agendamento: '2026-07-06',
    horario: '08:00:00',
    vagas_ocupadas: 1,
    status: 'confirmado',
    ...sobrescritas
  };
}

test('reagendar atendido preserva o registro do dia atendido e cria um agendamento novo', async () => {
  const queries = [];
  const conn = {
    async beginTransaction() {},
    async commit() {
      this.commitChamado = true;
    },
    async rollback() {},
    release() {},
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes('INSERT IGNORE INTO slots_agenda')) return [{}];
      if (sql.includes('FOR UPDATE')) return [[agendamentoBanco({ status: 'atendido' })]];
      if (sql.includes('WHERE cpf = ? AND data_agendamento = ?')) return [[{ total: 0 }]];
      if (sql.includes('UPDATE slots_agenda')) return [{ affectedRows: 1 }];
      if (sql.includes('INSERT INTO agendamentos')) return [{ insertId: 777 }];
      throw new Error(`SQL inesperado: ${sql}`);
    }
  };
  const pool = criarPoolMock(conn);

  const resultado = await slots.reagendarAgendamento(pool, 42, '2026-07-10', '09:00', 5);

  assert.equal(resultado.historicoPreservado, true);
  assert.equal(resultado.novoAgendamentoId, 777);
  assert.equal(resultado.dataAnterior, '2026-07-06');
  assert.equal(conn.commitChamado, true);

  // O registro atendido nao pode ser alterado nem ter a vaga devolvida.
  assert.equal(queries.some((q) => q.sql.includes('UPDATE agendamentos')), false);
  const updatesSlot = queries.filter((q) => q.sql.includes('UPDATE slots_agenda'));
  assert.equal(updatesSlot.length, 1);
  assert.match(updatesSlot[0].sql, /ocupadas \+ \?/);
  assert.deepEqual(updatesSlot[0].params, [1, '2026-07-10', '09:00', 1]);

  const insercao = queries.find((q) => q.sql.includes('INSERT INTO agendamentos'));
  assert.match(insercao.sql, /'confirmado'/);
  assert.equal(insercao.params.includes('2026-07-10'), true);
  assert.equal(insercao.params.includes('09:00'), true);
});

test('reagendar atendido recusa quando o paciente ja tem agendamento na nova data', async () => {
  const conn = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {
      this.rollbackChamado = true;
    },
    release() {},
    async query(sql) {
      if (sql.includes('INSERT IGNORE INTO slots_agenda')) return [{}];
      if (sql.includes('FOR UPDATE')) return [[agendamentoBanco({ status: 'atendido' })]];
      if (sql.includes('WHERE cpf = ? AND data_agendamento = ?')) return [[{ total: 1 }]];
      throw new Error(`SQL inesperado: ${sql}`);
    }
  };
  const pool = criarPoolMock(conn);

  await assert.rejects(
    () => slots.reagendarAgendamento(pool, 42, '2026-07-10', '09:00', 5),
    /ja possui um agendamento nesta data/
  );
  assert.equal(conn.rollbackChamado, true);
});

test('reagendar confirmado continua movendo o agendamento e limpa marcas antigas', async () => {
  const queries = [];
  const conn = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes('INSERT IGNORE INTO slots_agenda')) return [{}];
      if (sql.includes('FOR UPDATE')) return [[agendamentoBanco({ status: 'confirmado' })]];
      if (sql.includes('UPDATE slots_agenda')) return [{ affectedRows: 1 }];
      if (sql.includes('UPDATE agendamentos')) return [{ affectedRows: 1 }];
      throw new Error(`SQL inesperado: ${sql}`);
    }
  };
  const pool = criarPoolMock(conn);

  const resultado = await slots.reagendarAgendamento(pool, 42, '2026-07-10', '09:00', 5);

  assert.equal(resultado.historicoPreservado, false);
  assert.equal(queries.some((q) => q.sql.includes('INSERT INTO agendamentos')), false);

  const updateAgendamento = queries.find((q) => q.sql.includes('UPDATE agendamentos'));
  assert.match(updateAgendamento.sql, /presente_em = NULL/);
  assert.match(updateAgendamento.sql, /atendido_em = NULL/);

  // A vaga do horario antigo e devolvida no caminho de mover.
  const updatesSlot = queries.filter((q) => q.sql.includes('UPDATE slots_agenda'));
  assert.equal(updatesSlot.length, 2);
  assert.match(updatesSlot[0].sql, /GREATEST\(ocupadas - \?, 0\)/);
});

test('horarios disponiveis nao devolvem a vaga de um agendamento ja atendido', async () => {
  const pool = {
    async query(sql) {
      const resposta = respostaDiaNaoBloqueado(sql);
      if (resposta) return resposta;
      if (sql.includes('INSERT IGNORE INTO slots_agenda')) return [{}];
      if (sql.includes('SELECT data_agendamento, horario, vagas_ocupadas, status')) {
        return [[{ data_agendamento: '2026-07-06', horario: '08:00:00', vagas_ocupadas: 1, status: 'atendido' }]];
      }
      if (sql.includes('SELECT horario, capacidade, ocupadas')) {
        return [[{ horario: '08:00:00', capacidade: 8, ocupadas: 8 }]];
      }
      throw new Error(`SQL inesperado: ${sql}`);
    }
  };

  const resultado = await slots.horariosDisponiveis(pool, '2026-07-06', false, 42);

  assert.deepEqual(resultado, [{ horario: '08:00', vagasRestantes: 0, disponivel: false }]);
});

test('reagendar falta preserva o registro do dia e nao devolve a vaga queimada', async () => {
  const queries = [];
  const conn = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes('INSERT IGNORE INTO slots_agenda')) return [{}];
      if (sql.includes('FOR UPDATE')) return [[agendamentoBanco({ status: 'faltou' })]];
      if (sql.includes('WHERE cpf = ? AND data_agendamento = ?')) return [[{ total: 0 }]];
      if (sql.includes('UPDATE slots_agenda')) return [{ affectedRows: 1 }];
      if (sql.includes('INSERT INTO agendamentos')) return [{ insertId: 801 }];
      throw new Error(`SQL inesperado: ${sql}`);
    }
  };
  const pool = criarPoolMock(conn);

  const resultado = await slots.reagendarAgendamento(pool, 42, '2026-07-10', '09:00', 5);

  assert.equal(resultado.historicoPreservado, true);
  assert.equal(resultado.statusOrigem, 'faltou');
  assert.equal(resultado.novoAgendamentoId, 801);

  // A linha da falta nao pode ser alterada e a vaga do dia da falta continua ocupada.
  assert.equal(queries.some((q) => q.sql.includes('UPDATE agendamentos')), false);
  const updatesSlot = queries.filter((q) => q.sql.includes('UPDATE slots_agenda'));
  assert.equal(updatesSlot.length, 1);
  assert.match(updatesSlot[0].sql, /ocupadas \+ \?/);
  assert.deepEqual(updatesSlot[0].params, [1, '2026-07-10', '09:00', 1]);
});

test('reagendar cancelado mantem o cancelamento e ocupa vaga na nova data', async () => {
  const queries = [];
  const conn = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes('INSERT IGNORE INTO slots_agenda')) return [{}];
      if (sql.includes('FOR UPDATE')) return [[agendamentoBanco({ status: 'cancelado' })]];
      if (sql.includes('WHERE cpf = ? AND data_agendamento = ?')) return [[{ total: 0 }]];
      if (sql.includes('UPDATE slots_agenda')) return [{ affectedRows: 1 }];
      if (sql.includes('INSERT INTO agendamentos')) return [{ insertId: 802 }];
      throw new Error(`SQL inesperado: ${sql}`);
    }
  };
  const pool = criarPoolMock(conn);

  const resultado = await slots.reagendarAgendamento(pool, 42, '2026-07-10', '09:00', 5);

  assert.equal(resultado.historicoPreservado, true);
  assert.equal(resultado.statusOrigem, 'cancelado');

  // Antes o cancelado era revivido como 'confirmado' sem ocupar vaga nenhuma.
  assert.equal(queries.some((q) => q.sql.includes('UPDATE agendamentos')), false);
  const updatesSlot = queries.filter((q) => q.sql.includes('UPDATE slots_agenda'));
  assert.equal(updatesSlot.length, 1);
  assert.match(updatesSlot[0].sql, /ocupadas \+ \? <= capacidade/);
});

test('reagendar cancelado para a mesma data e horario reabre a vaga em vez de nao fazer nada', async () => {
  const queries = [];
  const conn = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes('INSERT IGNORE INTO slots_agenda')) return [{}];
      if (sql.includes('FOR UPDATE')) return [[agendamentoBanco({ status: 'cancelado' })]];
      if (sql.includes('WHERE cpf = ? AND data_agendamento = ?')) return [[{ total: 0 }]];
      if (sql.includes('UPDATE slots_agenda')) return [{ affectedRows: 1 }];
      if (sql.includes('INSERT INTO agendamentos')) return [{ insertId: 803 }];
      throw new Error(`SQL inesperado: ${sql}`);
    }
  };
  const pool = criarPoolMock(conn);

  const resultado = await slots.reagendarAgendamento(pool, 42, '2026-07-06', '08:00', 5);

  assert.equal(resultado.semAlteracao, undefined);
  assert.equal(resultado.novoAgendamentoId, 803);
});

test('reagendar confirmado para a mesma data e horario continua sendo no-op', async () => {
  const conn = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql) {
      if (sql.includes('INSERT IGNORE INTO slots_agenda')) return [{}];
      if (sql.includes('FOR UPDATE')) return [[agendamentoBanco({ status: 'confirmado' })]];
      throw new Error(`SQL inesperado: ${sql}`);
    }
  };
  const pool = criarPoolMock(conn);

  const resultado = await slots.reagendarAgendamento(pool, 42, '2026-07-06', '08:00', 5);

  assert.equal(resultado.semAlteracao, true);
});

test('horarios disponiveis nao devolvem a vaga de um agendamento que faltou', async () => {
  const pool = {
    async query(sql) {
      const resposta = respostaDiaNaoBloqueado(sql);
      if (resposta) return resposta;
      if (sql.includes('INSERT IGNORE INTO slots_agenda')) return [{}];
      if (sql.includes('SELECT data_agendamento, horario, vagas_ocupadas, status')) {
        return [[{ data_agendamento: '2026-07-06', horario: '08:00:00', vagas_ocupadas: 1, status: 'faltou' }]];
      }
      if (sql.includes('SELECT horario, capacidade, ocupadas')) {
        return [[{ horario: '08:00:00', capacidade: 8, ocupadas: 8 }]];
      }
      throw new Error(`SQL inesperado: ${sql}`);
    }
  };

  const resultado = await slots.horariosDisponiveis(pool, '2026-07-06', false, 42);

  assert.deepEqual(resultado, [{ horario: '08:00', vagasRestantes: 0, disponivel: false }]);
});
