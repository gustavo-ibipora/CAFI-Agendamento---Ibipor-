USE farmacia_ibipora;

ALTER TABLE agendamentos
  ADD INDEX IF NOT EXISTS idx_agendamentos_cpf (cpf),
  ADD INDEX IF NOT EXISTS idx_agendamentos_telefone (telefone),
  ADD INDEX IF NOT EXISTS idx_agendamentos_nome (nome_completo);
