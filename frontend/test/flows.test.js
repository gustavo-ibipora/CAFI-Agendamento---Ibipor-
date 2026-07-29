import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import test from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));
const ler = (arquivo) => readFileSync(join(root, arquivo), 'utf8');

test('fluxo de agendamento tem validacao inline e bloqueios claros', () => {
  const src = ler('src/pages/SchedulingPage.jsx');

  assert.match(src, /campo-invalido/);
  assert.match(src, /campo-valido/);
  assert.match(src, /campo-erro-texto/);
  assert.match(src, /ehFimDeSemana\(form\.data_agendamento\)/);
  assert.match(src, /apiJson\('\/api\/agendamentos'/);
  assert.match(src, /ultimoAgendamento/);
});

test('confirmacao permite imprimir e salvar comprovante como imagem', () => {
  const src = ler('src/pages/ConfirmationPage.jsx');

  assert.match(src, /Imprimir comprovante/);
  assert.match(src, /Salvar como imagem/);
  assert.match(src, /canvas/);
});

test('login admin e estados de erro usam API e feedback visual', () => {
  const src = ler('src/pages/AdminLoginPage.jsx');

  assert.match(src, /\/api\/admin\/login/);
  assert.match(src, /Message/);
  assert.match(src, /window\.location\.href = '\/admin\/agenda'/);
});

test('agenda admin protege acoes destrutivas com modal e feedback de erro', () => {
  const src = ler('src/pages/AdminAgendaPage.jsx');

  assert.match(src, /ConfirmDialog/);
  assert.match(src, /\/api\/admin\/agendamentos/);
  assert.match(src, /AdminReportsPage/);
  assert.match(src, /setErro/);
  assert.match(src, /reagendar/);
});

test('relatorios administrativos geram indicadores de agendamentos', () => {
  const src = ler('src/pages/AdminReportsPage.jsx');
  const app = ler('src/App.jsx');

  assert.match(src, /\/api\/admin\/relatorios\/agendamentos/);
  assert.match(src, /Demanda por UBS/);
  assert.match(src, /Demanda por tipo de medicamento/);
  assert.match(src, /Exportar CSV/);
  assert.match(app, /\/admin\/relatorios/);
});

test('criacao e exclusao de usuarios usam confirmacao e tratamento de erro', () => {
  const src = ler('src/pages/AdminCreateUserPage.jsx');

  assert.match(src, /\/api\/admin\/usuarios/);
  assert.match(src, /ConfirmDialog/);
  assert.match(src, /setErro/);
});

test('roteamento principal usa History API sem recarregar links internos', () => {
  const src = ler('src/App.jsx');

  assert.match(src, /pushState/);
  assert.match(src, /popstate/);
  assert.match(src, /document\.addEventListener\('click'/);
});
