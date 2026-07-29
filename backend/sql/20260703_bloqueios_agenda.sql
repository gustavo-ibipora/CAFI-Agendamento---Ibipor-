CREATE TABLE IF NOT EXISTS bloqueios_agenda (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  data_agendamento DATE NOT NULL,
  horario TIME NOT NULL,
  motivo VARCHAR(255),
  admin_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_bloqueio_horario (data_agendamento, horario),
  INDEX idx_bloqueios_data (data_agendamento)
);
