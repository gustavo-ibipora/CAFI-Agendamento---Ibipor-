const pool = require('../db');

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dias_bloqueados (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      data_agendamento DATE NOT NULL,
      motivo VARCHAR(255),
      admin_id INT,
      updated_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_dia_bloqueado (data_agendamento),
      INDEX idx_dias_bloqueados_data (data_agendamento)
    )
  `);

  console.log('Tabela dias_bloqueados verificada/criada com sucesso.');
}

main()
  .catch((err) => {
    console.error('Erro ao migrar dias_bloqueados:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
