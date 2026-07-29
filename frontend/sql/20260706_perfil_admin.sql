USE farmacia_ibipora;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  usuario VARCHAR(60) UNIQUE NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  role ENUM('ADMIN','OPERADOR') NOT NULL DEFAULT 'OPERADOR',
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS perfil ENUM('admin','operador') NOT NULL DEFAULT 'admin' AFTER senha_hash;

UPDATE admins SET perfil = 'admin' WHERE perfil IS NULL;

INSERT IGNORE INTO usuarios (id, nome, usuario, senha_hash, role, ativo, created_at)
SELECT id,
       nome,
       usuario,
       senha_hash,
       CASE WHEN perfil = 'operador' THEN 'OPERADOR' ELSE 'ADMIN' END,
       ativo,
       created_at
FROM admins;
