const pool = require('../db');

async function adicionarColunaAtivo() {
  try {
    await pool.query(
      'ALTER TABLE admins ADD COLUMN ativo TINYINT(1) NOT NULL DEFAULT 1 AFTER senha_hash'
    );
    console.log('Coluna admins.ativo criada.');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Coluna admins.ativo ja existe.');
      return;
    }
    throw err;
  }
}

async function criarTabelaSessoes() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS sessions (
      session_id VARCHAR(128) NOT NULL PRIMARY KEY,
      expires INT UNSIGNED NOT NULL,
      data MEDIUMTEXT
    )`
  );
  console.log('Tabela sessions verificada.');
}

async function main() {
  try {
    await adicionarColunaAtivo();
    await criarTabelaSessoes();
    console.log('Migracao de seguranca concluida.');
  } catch (err) {
    console.error('Erro na migracao de seguranca:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
