const pool = require('../db');

async function main() {
  try {
    await pool.query(`
      ALTER TABLE agendamentos
      ADD COLUMN encaixe TINYINT(1) NOT NULL DEFAULT 0 AFTER vagas_ocupadas
    `);
    console.log('Coluna encaixe adicionada com sucesso.');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('A coluna encaixe ja existe. Nada a fazer.');
      return;
    }
    throw err;
  }
}

main()
  .catch((err) => {
    console.error('Erro ao migrar encaixe_agendamento:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
