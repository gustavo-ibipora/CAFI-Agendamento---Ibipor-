const pool = require('../db');

async function main() {
  try {
    await pool.query('ALTER TABLE agendamentos ADD COLUMN receita_arquivo VARCHAR(255) NULL AFTER observacoes');
    console.log('Coluna receita_arquivo criada.');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Coluna receita_arquivo ja existe.');
    } else {
      console.error('Erro ao adicionar coluna receita_arquivo:', err.message);
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

main();
