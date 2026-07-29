USE farmacia_ibipora;

CREATE TABLE IF NOT EXISTS email_jobs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tipo VARCHAR(60) NOT NULL,
  destinatario VARCHAR(150) NOT NULL,
  assunto VARCHAR(255) NOT NULL,
  payload JSON NOT NULL,
  status ENUM('pendente','processando','enviado','falha') NOT NULL DEFAULT 'pendente',
  tentativas TINYINT NOT NULL DEFAULT 0,
  ultimo_erro VARCHAR(500),
  proxima_tentativa DATETIME,
  enviado_em DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email_jobs_fila (status, proxima_tentativa, tentativas, id)
);
