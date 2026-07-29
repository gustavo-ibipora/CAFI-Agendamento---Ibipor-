USE farmacia_ibipora;

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

INSERT INTO pacientes (cpf, nome_completo, data_nascimento, endereco, telefone, email, ubs, ativo)
SELECT
  a.cpf,
  SUBSTRING_INDEX(GROUP_CONCAT(a.nome_completo ORDER BY a.created_at DESC SEPARATOR '||'), '||', 1) AS nome_completo,
  SUBSTRING_INDEX(GROUP_CONCAT(a.data_nascimento ORDER BY a.created_at DESC SEPARATOR '||'), '||', 1) AS data_nascimento,
  SUBSTRING_INDEX(GROUP_CONCAT(a.endereco ORDER BY a.created_at DESC SEPARATOR '||'), '||', 1) AS endereco,
  SUBSTRING_INDEX(GROUP_CONCAT(a.telefone ORDER BY a.created_at DESC SEPARATOR '||'), '||', 1) AS telefone,
  SUBSTRING_INDEX(GROUP_CONCAT(a.email ORDER BY a.created_at DESC SEPARATOR '||'), '||', 1) AS email,
  SUBSTRING_INDEX(GROUP_CONCAT(a.ubs ORDER BY a.created_at DESC SEPARATOR '||'), '||', 1) AS ubs,
  1 AS ativo
FROM agendamentos a
GROUP BY a.cpf
ON DUPLICATE KEY UPDATE
  nome_completo = VALUES(nome_completo),
  data_nascimento = VALUES(data_nascimento),
  endereco = VALUES(endereco),
  telefone = VALUES(telefone),
  email = VALUES(email),
  ubs = VALUES(ubs),
  ativo = 1,
  updated_at = CURRENT_TIMESTAMP;
