USE farmacia_ibipora;

ALTER TABLE agendamentos
  ADD COLUMN receita_arquivo VARCHAR(255) NULL AFTER observacoes;
