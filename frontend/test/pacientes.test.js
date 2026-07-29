const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buscarPacientePorCpf,
  buscarPacienteEmAgendamentos,
  buscarOuImportarPacientePorCpf,
  salvarPaciente
} = require('../services/pacientes');

test('busca paciente ativo por CPF', async () => {
  const pool = {
    async query(sql, params) {
      assert.match(sql, /FROM pacientes/);
      assert.deepEqual(params, ['52998224725']);
      return [[{
        cpf: '52998224725',
        nome_completo: 'Teste Usuario'
      }]];
    }
  };

  const paciente = await buscarPacientePorCpf(pool, '52998224725');

  assert.equal(paciente.nome_completo, 'Teste Usuario');
});

test('salva paciente com upsert por CPF', async () => {
  let sqlExecutado = '';
  let parametros = [];
  const conn = {
    async query(sql, params) {
      sqlExecutado = sql;
      parametros = params;
      return [{}];
    }
  };

  await salvarPaciente(conn, {
    cpf: '52998224725',
    nome_completo: 'Teste Usuario',
    data_nascimento: '1990-01-01',
    endereco: 'Rua Teste, 123',
    telefone: '43999999999',
    email: 'teste@example.com',
    ubs: 'UBS San Rafael'
  });

  assert.match(sqlExecutado, /ON DUPLICATE KEY UPDATE/);
  assert.deepEqual(parametros, [
    '52998224725',
    'Teste Usuario',
    '1990-01-01',
    'Rua Teste, 123',
    '43999999999',
    'teste@example.com',
    'UBS San Rafael'
  ]);
});

test('busca paciente no historico de agendamentos quando ainda nao existe em pacientes', async () => {
  const chamadas = [];
  const pool = {
    async query(sql, params) {
      chamadas.push(sql);
      if (sql.includes('FROM pacientes')) return [[]];
      if (sql.includes('FROM agendamentos')) {
        assert.deepEqual(params, ['10915554941']);
        return [[{
          cpf: '10915554941',
          nome_completo: 'Gustavo Betiati Ferreira',
          data_nascimento: '1990-01-01',
          endereco: 'Rua Teste',
          telefone: '43999999999',
          email: 'gustavo@example.com',
          ubs: 'UBS San Rafael'
        }]];
      }
      if (sql.includes('INSERT INTO pacientes')) return [{}];
      throw new Error(`SQL inesperado: ${sql}`);
    }
  };

  const paciente = await buscarOuImportarPacientePorCpf(pool, '10915554941');

  assert.equal(paciente.nome_completo, 'Gustavo Betiati Ferreira');
  assert.equal(chamadas.some((sql) => sql.includes('FROM agendamentos')), true);
  assert.equal(chamadas.some((sql) => sql.includes('INSERT INTO pacientes')), true);
});

test('busca paciente diretamente no historico de agendamentos', async () => {
  const pool = {
    async query(sql, params) {
      assert.match(sql, /FROM agendamentos/);
      assert.deepEqual(params, ['10915554941']);
      return [[{ cpf: '10915554941', nome_completo: 'Historico' }]];
    }
  };

  const paciente = await buscarPacienteEmAgendamentos(pool, '10915554941');

  assert.equal(paciente.nome_completo, 'Historico');
});
