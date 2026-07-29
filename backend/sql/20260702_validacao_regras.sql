USE farmacia_ibipora;

ALTER TABLE agendamentos
  MODIFY tipo_medicamento VARCHAR(80) NOT NULL;

UPDATE agendamentos
SET tipo_medicamento = 'Antibiotico'
WHERE tipo_medicamento LIKE 'Antibi%';

UPDATE agendamentos
SET tipo_medicamento = 'Nao sei'
WHERE tipo_medicamento LIKE 'N%sei';

ALTER TABLE agendamentos
  MODIFY tipo_medicamento ENUM('Antibiotico','Medicamento Controlado','Medicamento do Estado (CEAF)','Nao sei') NOT NULL;
