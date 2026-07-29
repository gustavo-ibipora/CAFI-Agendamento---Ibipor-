import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aplicarMascaraCpf,
  aplicarMascaraTelefone,
  cpfValido,
  dataBrasil,
  emailValido,
  ehFimDeSemana,
  somenteDigitos,
  telefoneValido
} from '../src/utils.js';

test('mascaras e validacoes principais do formulario', () => {
  assert.equal(somenteDigitos('CPF 123.456.789-00'), '12345678900');
  assert.equal(aplicarMascaraCpf('52998224725'), '529.982.247-25');
  assert.equal(aplicarMascaraTelefone('43999998888'), '(43) 99999-8888');
  assert.equal(cpfValido('529.982.247-25'), true);
  assert.equal(cpfValido('111.111.111-11'), false);
  assert.equal(telefoneValido('(43) 99999-8888'), true);
  assert.equal(emailValido('paciente@exemplo.com'), true);
  assert.equal(emailValido('paciente@'), false);
});

test('datas usadas no agendamento', () => {
  assert.equal(ehFimDeSemana('2026-07-04'), true);
  assert.equal(ehFimDeSemana('2026-07-06'), false);
  assert.equal(dataBrasil('2026-07-07'), '07/07/2026');
});
