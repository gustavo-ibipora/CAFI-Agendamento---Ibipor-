const pool = require('../db');

async function main() {
  const [, , usuario, status] = process.argv;

  if (!usuario || !status || !['ativo', 'inativo'].includes(status)) {
    console.log('Uso: node scripts/definir-admin-ativo.js <usuario> <ativo|inativo>');
    process.exit(1);
  }

  const ativo = status === 'ativo' ? 1 : 0;

  try {
    const [result] = await pool.query(
      'UPDATE admins SET ativo = ? WHERE usuario = ?',
      [ativo, usuario]
    );

    if (result.affectedRows === 0) {
      console.log(`Administrador "${usuario}" nao encontrado.`);
      return;
    }

    console.log(`Administrador "${usuario}" marcado como ${status}.`);
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      console.error('A coluna "ativo" ainda nao existe. Rode a migracao de seguranca em backend/sql/20260702_seguranca.sql.');
    } else {
      console.error('Erro ao atualizar administrador:', err.message);
    }
  } finally {
    await pool.end();
  }
}

main();
