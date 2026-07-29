require('dotenv').config();
const pool = require('../db');

async function up() {
  try {
    console.log('Adicionando colunas atendido_por e atendido_em na tabela agendamentos...');
    await pool.query(`
      ALTER TABLE agendamentos 
      ADD COLUMN atendido_por INT NULL,
      ADD COLUMN atendido_em DATETIME NULL
    `);
    console.log('Migração concluída com sucesso!');
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('As colunas já existem. Nenhuma ação necessária.');
    } else {
      console.error('Erro na migração:', error);
    }
  } finally {
    process.exit(0);
  }
}

up();
