CREATE DATABASE IF NOT EXISTS farmacia_ibipora CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE farmacia_ibipora;

CREATE TABLE IF NOT EXISTS ubs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tipos_medicamento (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(80) NOT NULL UNIQUE,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pacientes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  cpf VARCHAR(11) NOT NULL UNIQUE,
  nome_completo VARCHAR(150) NOT NULL,
  data_nascimento DATE NOT NULL,
  endereco VARCHAR(255) NOT NULL,
  telefone VARCHAR(20) NOT NULL,
  email VARCHAR(150) NOT NULL,
  ubs VARCHAR(100) NOT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pacientes_nome (nome_completo)
);

CREATE TABLE IF NOT EXISTS agendamentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome_completo VARCHAR(150) NOT NULL,
  cpf VARCHAR(11) NOT NULL,
  data_nascimento DATE NOT NULL,
  endereco VARCHAR(255) NOT NULL,
  telefone VARCHAR(20) NOT NULL,
  email VARCHAR(150) NOT NULL,
  ubs VARCHAR(100) NOT NULL,
  tipo_medicamento ENUM('Antibiotico','Medicamento Controlado','Medicamento do Estado (CEAF)','Nao sei') NOT NULL,
  primeiro_atendimento TINYINT(1) NOT NULL,
  previsao_termino DATE NOT NULL,
  observacoes TEXT,
  receita_arquivo VARCHAR(255) NULL,
  data_agendamento DATE NOT NULL,
  horario TIME NOT NULL,
  vagas_ocupadas TINYINT NOT NULL DEFAULT 1,
  status ENUM('confirmado','cancelado','atendido','faltou','presente') NOT NULL DEFAULT 'confirmado',
  presente_por INT NULL,
  presente_em DATETIME NULL,
  atendido_por INT NULL,
  atendido_em DATETIME NULL,
  created_by INT NULL,
  updated_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_agendamentos_cpf (cpf),
  INDEX idx_agendamentos_telefone (telefone),
  INDEX idx_agendamentos_nome (nome_completo),
  INDEX idx_data_horario (data_agendamento, horario),
  INDEX idx_data_tipo (data_agendamento, tipo_medicamento),
  INDEX idx_data_ubs (data_agendamento, ubs),
  INDEX idx_admin_filtros (data_agendamento, ubs, tipo_medicamento, horario)
);

CREATE TABLE IF NOT EXISTS slots_agenda (
  data_agendamento DATE NOT NULL,
  horario TIME NOT NULL,
  capacidade TINYINT NOT NULL DEFAULT 8,
  ocupadas TINYINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (data_agendamento, horario),
  CHECK (ocupadas >= 0),
  CHECK (ocupadas <= capacidade)
);

CREATE TABLE IF NOT EXISTS bloqueios_agenda (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  data_agendamento DATE NOT NULL,
  horario TIME NOT NULL,
  motivo VARCHAR(255),
  admin_id INT,
  updated_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_bloqueio_horario (data_agendamento, horario),
  INDEX idx_bloqueios_data (data_agendamento)
);

CREATE TABLE IF NOT EXISTS contadores_diarios (
  data DATE NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  valor INT NOT NULL DEFAULT 0,
  PRIMARY KEY (data, tipo)
);

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  usuario VARCHAR(60) UNIQUE NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  role ENUM('ADMIN','OPERADOR') NOT NULL DEFAULT 'OPERADOR',
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT NULL,
  updated_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  usuario VARCHAR(60) UNIQUE NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  perfil ENUM('admin','operador') NOT NULL DEFAULT 'admin',
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) NOT NULL PRIMARY KEY,
  expires INT UNSIGNED NOT NULL,
  data MEDIUMTEXT
);

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

INSERT IGNORE INTO ubs (nome, ordem) VALUES
  ('Centro de Saude Dr. Eugenio Dal Molin', 1),
  ('UBS San Rafael', 2),
  ('UBS Perola', 3),
  ('UBS Bom Pastor', 4),
  ('UBS La Fontaine', 5),
  ('UBS Vila Esperanca', 6),
  ('UBS Taquara do Reino', 7),
  ('UBS Jhon Kennedy', 8),
  ('UBS Serraia', 9);

INSERT IGNORE INTO tipos_medicamento (nome, ordem) VALUES
  ('Antibiotico', 1),
  ('Medicamento Controlado', 2),
  ('Medicamento do Estado (CEAF)', 3),
  ('Nao sei', 4);
