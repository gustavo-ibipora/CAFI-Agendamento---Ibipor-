const pool = require('../db');

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bloqueios_agenda (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      data_agendamento DATE NOT NULL,
      horario TIME NOT NULL,
      motivo VARCHAR(255),
      admin_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_bloqueio_horario (data_agendamento, horario),
      INDEX idx_bloqueios_data (data_agendamento)
    )
  `);

  console.log('Tabela bloqueios_agenda verificada/criada com sucesso.');
}

main()
  .catch((err) => {
    console.error('Erro ao migrar bloqueios_agenda:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
