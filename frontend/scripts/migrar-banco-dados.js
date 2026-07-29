const pool = require('../db');
const { UBS_PADRAO, TIPOS_MEDICAMENTO_PADRAO } = require('../services/dominios');

async function executarIgnorandoDuplicado(sql, params = []) {
  try {
    await pool.query(sql, params);
  } catch (err) {
    if (err.code === 'ER_DUP_KEYNAME' || err.code === 'ER_TABLE_EXISTS_ERROR') return;
    throw err;
  }
}

async function criarTabelas() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS ubs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(100) NOT NULL UNIQUE,
      ativo TINYINT(1) NOT NULL DEFAULT 1,
      ordem INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );

  await pool.query(
    `CREATE TABLE IF NOT EXISTS tipos_medicamento (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(80) NOT NULL UNIQUE,
      ativo TINYINT(1) NOT NULL DEFAULT 1,
      ordem INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );

  await pool.query(
    `CREATE TABLE IF NOT EXISTS slots_agenda (
      data_agendamento DATE NOT NULL,
      horario TIME NOT NULL,
      capacidade TINYINT NOT NULL DEFAULT 8,
      ocupadas TINYINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (data_agendamento, horario),
      CHECK (ocupadas >= 0),
      CHECK (ocupadas <= capacidade)
    )`
  );
}

async function seedDominios() {
  for (let i = 0; i < UBS_PADRAO.length; i++) {
    await pool.query(
      'INSERT IGNORE INTO ubs (nome, ordem) VALUES (?, ?)',
      [UBS_PADRAO[i], i + 1]
    );
  }

  for (let i = 0; i < TIPOS_MEDICAMENTO_PADRAO.length; i++) {
    await pool.query(
      'INSERT IGNORE INTO tipos_medicamento (nome, ordem) VALUES (?, ?)',
      [TIPOS_MEDICAMENTO_PADRAO[i], i + 1]
    );
  }
}

async function criarIndices() {
  await executarIgnorandoDuplicado(
    'CREATE INDEX idx_data_ubs ON agendamentos (data_agendamento, ubs)'
  );
  await executarIgnorandoDuplicado(
    'CREATE INDEX idx_admin_filtros ON agendamentos (data_agendamento, ubs, tipo_medicamento, horario)'
  );
}

async function popularSlotsExistentes() {
  await pool.query(
    `INSERT INTO slots_agenda (data_agendamento, horario, capacidade, ocupadas)
     SELECT
       data_agendamento,
       horario,
       8 AS capacidade,
       LEAST(COALESCE(SUM(vagas_ocupadas), 0), 8) AS ocupadas
     FROM agendamentos
     WHERE status IN ('confirmado', 'atendido', 'faltou')
     GROUP BY data_agendamento, horario
     ON DUPLICATE KEY UPDATE
       ocupadas = VALUES(ocupadas),
       capacidade = VALUES(capacidade)`
  );
}

async function main() {
  try {
    await criarTabelas();
    await seedDominios();
    await criarIndices();
    await popularSlotsExistentes();
    console.log('Migracao de banco de dados concluida.');
  } catch (err) {
    console.error('Erro na migracao de banco de dados:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
