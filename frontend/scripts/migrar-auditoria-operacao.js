const pool = require('../db');
const { garantirTabelaAuditoria } = require('../services/auditoria');

async function adicionarColuna(tabela, coluna, definicao) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tabela, coluna]
  );

  if (Number(rows[0]?.total || 0) === 0) {
    await pool.query(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
  }
}

async function main() {
  try {
    await adicionarColuna('usuarios', 'created_by', 'INT NULL AFTER ativo');
    await adicionarColuna('usuarios', 'updated_by', 'INT NULL AFTER created_by');
    await adicionarColuna('usuarios', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');

    await adicionarColuna('agendamentos', 'created_by', 'INT NULL AFTER status');
    await adicionarColuna('agendamentos', 'updated_by', 'INT NULL AFTER created_by');
    await adicionarColuna('agendamentos', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');

    await adicionarColuna('bloqueios_agenda', 'updated_by', 'INT NULL AFTER admin_id');
    await adicionarColuna('bloqueios_agenda', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');

    await garantirTabelaAuditoria(pool);
    console.log('Migracao de auditoria e operacao concluida.');
  } catch (err) {
    console.error('Erro na migracao de auditoria e operacao:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
