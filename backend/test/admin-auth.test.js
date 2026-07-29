const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { autenticarAdmin } = require('../services/admin-auth');

test('autentica admin ativo com senha correta', async () => {
  const senhaHash = await bcrypt.hash('SenhaForte@123', 4);
  const pool = {
    async query() {
      return [[{
        id: 1,
        nome: 'Administrador',
        usuario: 'admin',
        senha_hash: senhaHash,
        ativo: 1
      }]];
    }
  };

  const admin = await autenticarAdmin(pool, 'admin', 'SenhaForte@123');

  assert.deepEqual(admin, {
    id: 1,
    nome: 'Administrador',
    usuario: 'admin',
    role: 'ADMIN'
  });
});

test('preserva perfil do operador autenticado', async () => {
  const senhaHash = await bcrypt.hash('SenhaForte@123', 4);
  const pool = {
    async query() {
      return [[{
        id: 2,
        nome: 'Operador',
        usuario: 'operador',
        senha_hash: senhaHash,
        ativo: 1,
        role: 'OPERADOR'
      }]];
    }
  };

  const admin = await autenticarAdmin(pool, 'operador', 'SenhaForte@123');

  assert.equal(admin.role, 'OPERADOR');
});

test('rejeita senha errada e admin inativo', async () => {
  const senhaHash = await bcrypt.hash('SenhaForte@123', 4);
  const poolAtivo = {
    async query() {
      return [[{ id: 1, nome: 'Administrador', usuario: 'admin', senha_hash: senhaHash, ativo: 1 }]];
    }
  };
  const poolInativo = {
    async query() {
      return [[{ id: 1, nome: 'Administrador', usuario: 'admin', senha_hash: senhaHash, ativo: 0 }]];
    }
  };

  assert.equal(await autenticarAdmin(poolAtivo, 'admin', 'errada'), null);
  assert.equal(await autenticarAdmin(poolInativo, 'admin', 'SenhaForte@123'), null);
});
