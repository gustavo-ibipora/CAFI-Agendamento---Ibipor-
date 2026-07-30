CREATE TABLE IF NOT EXISTS dias_bloqueados (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  data_agendamento DATE NOT NULL,
  motivo VARCHAR(255),
  admin_id INT,
  updated_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_dia_bloqueado (data_agendamento),
  INDEX idx_dias_bloqueados_data (data_agendamento)
);
