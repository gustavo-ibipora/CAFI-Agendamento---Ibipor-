USE farmacia_ibipora;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS created_by INT NULL AFTER ativo,
  ADD COLUMN IF NOT EXISTS updated_by INT NULL AFTER created_by,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS created_by INT NULL AFTER status,
  ADD COLUMN IF NOT EXISTS updated_by INT NULL AFTER created_by,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

ALTER TABLE bloqueios_agenda
  ADD COLUMN IF NOT EXISTS updated_by INT NULL AFTER admin_id,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

CREATE TABLE IF NOT EXISTS auditoria_eventos (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  evento VARCHAR(80) NOT NULL,
  entidade VARCHAR(60) NOT NULL,
  entidade_id VARCHAR(80),
  admin_id INT,
  admin_nome VARCHAR(100),
  detalhes JSON,
  ip VARCHAR(45),
  user_agent VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_auditoria_data (created_at),
  INDEX idx_auditoria_evento (evento),
  INDEX idx_auditoria_admin (admin_id)
);
