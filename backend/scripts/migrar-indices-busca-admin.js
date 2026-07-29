const pool = require('../db');

async function criarIndice(nome, sql) {
  try {
    await pool.query(sql);
    console.log(`Indice ${nome} criado ou ja existente.`);
  } catch (err) {
    if (err.code === 'ER_DUP_KEYNAME') {
      console.log(`Indice ${nome} ja existe.`);
      return;
    }
    throw err;
  }
}

async function main() {
  try {
    await criarIndice(
      'idx_agendamentos_cpf',
      'ALTER TABLE agendamentos ADD INDEX idx_agendamentos_cpf (cpf)'
    );
    await criarIndice(
      'idx_agendamentos_telefone',
      'ALTER TABLE agendamentos ADD INDEX idx_agendamentos_telefone (telefone)'
    );
    await criarIndice(
      'idx_agendamentos_nome',
      'ALTER TABLE agendamentos ADD INDEX idx_agendamentos_nome (nome_completo)'
    );
  } catch (err) {
    console.error('Erro ao criar indices de busca administrativa:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
