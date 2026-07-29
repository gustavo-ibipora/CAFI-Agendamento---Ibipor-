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

CREATE INDEX idx_data_ubs ON agendamentos (data_agendamento, ubs);
CREATE INDEX idx_admin_filtros ON agendamentos (data_agendamento, ubs, tipo_medicamento, horario);

INSERT INTO slots_agenda (data_agendamento, horario, capacidade, ocupadas)
SELECT
  data_agendamento,
  horario,
  8 AS capacidade,
  LEAST(COALESCE(SUM(vagas_ocupadas), 0), 8) AS ocupadas
FROM agendamentos
WHERE status IN ('confirmado', 'atendido', 'faltou')
GROUP BY data_agendamento, horario
ON DUPLICATE KEY UPDATE
  ocupadas = VALUES(ocupadas),
  capacidade = VALUES(capacidade);
