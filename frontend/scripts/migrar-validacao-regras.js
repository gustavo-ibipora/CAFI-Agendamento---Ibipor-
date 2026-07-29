const pool = require('../db');

async function main() {
  try {
    await pool.query('ALTER TABLE agendamentos MODIFY tipo_medicamento VARCHAR(80) NOT NULL');
    await pool.query("UPDATE agendamentos SET tipo_medicamento = 'Antibiotico' WHERE tipo_medicamento LIKE 'Antibi%'");
    await pool.query("UPDATE agendamentos SET tipo_medicamento = 'Nao sei' WHERE tipo_medicamento LIKE 'N%sei'");
    await pool.query(
      "ALTER TABLE agendamentos MODIFY tipo_medicamento ENUM('Antibiotico','Medicamento Controlado','Medicamento do Estado (CEAF)','Nao sei') NOT NULL"
    );
    console.log('Migracao de validacao e regras concluida.');
  } catch (err) {
    console.error('Erro na migracao de validacao e regras:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
