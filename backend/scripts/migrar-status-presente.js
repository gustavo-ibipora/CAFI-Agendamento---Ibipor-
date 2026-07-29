require('dotenv').config();
const pool = require('../db');

async function up() {
  try {
    console.log('Alterando ENUM de status e adicionando colunas presente_por, presente_em...');
    
    // First alter the ENUM to include 'presente'
    await pool.query(`
      ALTER TABLE agendamentos 
      MODIFY COLUMN status ENUM('confirmado','cancelado','atendido','faltou','presente') NOT NULL DEFAULT 'confirmado'
    `);
    
    // Then add the new columns
    await pool.query(`
      ALTER TABLE agendamentos 
      ADD COLUMN presente_por INT NULL,
      ADD COLUMN presente_em DATETIME NULL
    `);
    console.log('Migração concluída com sucesso!');
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('As colunas já existem. Apenas o ENUM pode ter sido atualizado.');
    } else {
      console.error('Erro na migração:', error);
    }
  } finally {
    process.exit(0);
  }
}

up();
