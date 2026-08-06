ALTER TABLE agendamentos
  ADD COLUMN encaixe TINYINT(1) NOT NULL DEFAULT 0 AFTER vagas_ocupadas;
