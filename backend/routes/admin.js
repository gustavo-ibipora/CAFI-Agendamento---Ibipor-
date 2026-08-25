const path = require('path');
const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { autenticarAdmin } = require('../services/admin-auth');
const slots = require('../services/slots');
const ExcelJS = require('exceljs');
const { validarSenhaForte, mensagemSenhaForte } = require('../services/senhas');
const asyncHandler = require('../middleware/async-handler');
const AppError = require('../utils/app-error');
const logger = require('../utils/logger');
const {
  validarLogin,
  validarAlteracaoSenha,
  validarCriacaoUsuario,
  validarAtualizacaoUsuario,
  validarId,
  validarStatus,
  validarFiltrosAgenda,
  validarReagendamento,
  validarNovoAgendamentoAdmin,
  validarBloqueio,
  validarDiaBloqueado,
  validarBuscaPaciente,
  validarHorariosAdmin,
  validarLogsAdmin,
  validarRelatorioAgendamentos
} = require('../validators/admin');
const { listarDominios } = require('../services/dominios');
const { dataHojeISO } = require('../services/datas');
const { registrarAuditoria, listarAuditoria } = require('../services/auditoria');
const { enfileirarConfirmacao } = require('../services/email-queue');
const { DIRETORIO_RECEITAS } = require('../middleware/upload-receita');

const router = express.Router();

function exigirLogin(req, res, next) {
  if (!req.session.adminId) {
    return next(new AppError(401, 'Sessao expirada ou nao autenticada. Faca login novamente.', 'NAO_AUTENTICADO'));
  }
  next();
}

function exigirAdministrador(req, res, next) {
  const role = req.session.adminRole || String(req.session.adminPerfil || '').toUpperCase();
  if (role !== 'ADMIN') {
    return next(new AppError(403, 'Apenas usuarios ADMIN podem gerenciar usuarios.', 'PERMISSAO_NEGADA'));
  }
  next();
}

function dadosRequisicao(req) {
  return {
    ip: req.ip,
    userAgent: req.get('user-agent')
  };
}

function dadosAuditoria(req, sobrescritas = {}) {
  return {
    adminId: req.session.adminId,
    adminNome: req.session.adminNome,
    ...dadosRequisicao(req),
    ...sobrescritas
  };
}

async function contarAdminsAtivos(excetoId = null) {
  const parametros = [];
  let filtro = "WHERE role = 'ADMIN' AND ativo = 1";
  if (excetoId) {
    filtro += ' AND id <> ?';
    parametros.push(excetoId);
  }
  const [rows] = await pool.query(`SELECT COUNT(*) AS total FROM usuarios ${filtro}`, parametros);
  return Number(rows[0]?.total || 0);
}

router.post('/login', asyncHandler(async (req, res) => {
  const validacao = validarLogin(req.body);
  if (!validacao.ok) {
    throw new AppError(400, validacao.mensagem, 'VALIDACAO_LOGIN', validacao.detalhes);
  }
  const { usuario, senha } = validacao.dados;

  const admin = await autenticarAdmin(pool, usuario, senha);
  if (!admin) {
    logger.warn('admin.login_falhou', {
      usuario,
      motivo: 'credenciais_invalidas',
      ...dadosRequisicao(req)
    });
    throw new AppError(401, 'Usuario ou senha invalidos.', 'CREDENCIAIS_INVALIDAS');
  }

  req.session.adminId = admin.id;
  req.session.adminNome = admin.nome;
  req.session.adminRole = admin.role;

  logger.info('admin.login_sucesso', {
    adminId: admin.id,
    usuario: admin.usuario,
    ...dadosRequisicao(req)
  });

  await registrarAuditoria(pool, {
    evento: 'admin.login_sucesso',
    entidade: 'usuario',
    entidadeId: admin.id,
    adminId: admin.id,
    adminNome: admin.nome,
    detalhes: { usuario: admin.usuario },
    ...dadosRequisicao(req)
  });

  res.json({ nome: admin.nome, usuario: admin.usuario, role: admin.role });
}));

router.post('/logout', (req, res) => {
  const adminId = req.session.adminId;
  const adminNome = req.session.adminNome;
  const requisicao = dadosRequisicao(req);
  req.session.destroy(() => {
    logger.info('admin.logout', { adminId });
    registrarAuditoria(pool, {
      evento: 'admin.logout',
      entidade: 'usuario',
      entidadeId: adminId,
      adminId,
      adminNome,
      detalhes: {},
      ...requisicao
    }).catch((err) => logger.warn('auditoria.logout_falhou', { adminId, erro: err.message }));
    res.json({ ok: true });
  });
});

router.get('/sessao', (req, res) => {
  if (!req.session.adminId) return res.status(401).json({ autenticado: false });
  const role = req.session.adminRole || String(req.session.adminPerfil || 'admin').toUpperCase();
  res.json({ autenticado: true, nome: req.session.adminNome, role });
});

router.get('/usuarios', exigirLogin, exigirAdministrador, asyncHandler(async (req, res) => {
  let rows;
  try {
    [rows] = await pool.query(
      `SELECT id, nome, usuario, role, ativo, created_by, updated_by,
              DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
       FROM usuarios
       ORDER BY nome, usuario`
    );
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_FIELD_ERROR') {
      throw new AppError(500, 'A migracao da tabela de usuarios ainda nao foi aplicada.', 'MIGRACAO_USUARIOS_PENDENTE');
    }
    throw err;
  }
  res.json({ usuarios: rows });
}));

router.post('/usuarios', exigirLogin, exigirAdministrador, asyncHandler(async (req, res) => {
  const validacao = validarCriacaoUsuario(req.body);
  if (!validacao.ok) {
    throw new AppError(400, validacao.mensagem, 'VALIDACAO_USUARIO', validacao.detalhes);
  }
  const { nome, usuario, senha, role } = validacao.dados;

  const errosSenha = validarSenhaForte(senha);
  if (errosSenha.length > 0) {
    throw new AppError(400, mensagemSenhaForte(errosSenha), 'SENHA_FRACA', errosSenha);
  }

  const senhaHash = await bcrypt.hash(senha, 10);

  try {
    const [resultado] = await pool.query(
      'INSERT INTO usuarios (nome, usuario, senha_hash, role, ativo, created_by, updated_by) VALUES (?, ?, ?, ?, 1, ?, ?)',
      [nome, usuario, senhaHash, role, req.session.adminId, req.session.adminId]
    );

    logger.info('admin.usuario_criado', {
      adminId: req.session.adminId,
      usuarioId: resultado.insertId,
      usuario,
      role,
      ...dadosRequisicao(req)
    });
    await registrarAuditoria(pool, {
      evento: 'admin.usuario_criado',
      entidade: 'usuario',
      entidadeId: resultado.insertId,
      detalhes: { usuario, role },
      ...dadosAuditoria(req)
    });

    res.status(201).json({
      ok: true,
      usuario: {
        id: resultado.insertId,
        nome,
        usuario,
        role
      }
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new AppError(409, 'Ja existe um usuario com este login.', 'USUARIO_DUPLICADO');
    }
    if (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_FIELD_ERROR') {
      throw new AppError(500, 'A migracao da tabela de usuarios ainda nao foi aplicada.', 'MIGRACAO_USUARIOS_PENDENTE');
    }
    throw err;
  }
}));

router.put('/usuarios/:id', exigirLogin, exigirAdministrador, asyncHandler(async (req, res) => {
  const idValidacao = validarId(req.params);
  if (!idValidacao.ok) {
    throw new AppError(400, idValidacao.mensagem, 'ID_INVALIDO', idValidacao.detalhes);
  }

  const validacao = validarAtualizacaoUsuario(req.body);
  if (!validacao.ok) {
    throw new AppError(400, validacao.mensagem, 'VALIDACAO_USUARIO', validacao.detalhes);
  }

  const id = idValidacao.dados.id;
  const { nome, usuario, role, ativo, senha } = validacao.dados;

  const [atuais] = await pool.query('SELECT id, usuario, role, ativo FROM usuarios WHERE id = ?', [id]);
  const atual = atuais[0];
  if (!atual) {
    throw new AppError(404, 'Usuario nao encontrado.', 'USUARIO_NAO_ENCONTRADO');
  }

  if (id === req.session.adminId && (!ativo || role !== 'ADMIN')) {
    throw new AppError(409, 'Voce nao pode remover suas proprias permissoes de ADMIN.', 'AUTO_ALTERACAO_INVALIDA');
  }

  if (atual.role === 'ADMIN' && (!ativo || role !== 'ADMIN')) {
    const outrosAdmins = await contarAdminsAtivos(id);
    if (outrosAdmins === 0) {
      throw new AppError(409, 'Mantenha pelo menos um usuario ADMIN ativo.', 'ULTIMO_ADMIN');
    }
  }

  const campos = ['nome = ?', 'usuario = ?', 'role = ?', 'ativo = ?', 'updated_by = ?'];
  const parametros = [nome, usuario, role, ativo ? 1 : 0, req.session.adminId];

  if (senha) {
    const errosSenha = validarSenhaForte(senha);
    if (errosSenha.length > 0) {
      throw new AppError(400, mensagemSenhaForte(errosSenha), 'SENHA_FRACA', errosSenha);
    }
    campos.push('senha_hash = ?');
    parametros.push(await bcrypt.hash(senha, 10));
  }

  parametros.push(id);

  try {
    await pool.query(`UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`, parametros);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new AppError(409, 'Ja existe um usuario com este login.', 'USUARIO_DUPLICADO');
    }
    throw err;
  }

  logger.info('admin.usuario_atualizado', {
    adminId: req.session.adminId,
    usuarioId: id,
    usuario,
    role,
    ativo,
    ...dadosRequisicao(req)
  });
  await registrarAuditoria(pool, {
    evento: 'admin.usuario_atualizado',
    entidade: 'usuario',
    entidadeId: id,
    detalhes: {
      usuarioAnterior: atual.usuario,
      usuario,
      roleAnterior: atual.role,
      role,
      ativoAnterior: Boolean(atual.ativo),
      ativo: Boolean(ativo),
      senhaAlterada: Boolean(senha)
    },
    ...dadosAuditoria(req)
  });

  res.json({ ok: true });
}));

router.delete('/usuarios/:id', exigirLogin, exigirAdministrador, asyncHandler(async (req, res) => {
  const idValidacao = validarId(req.params);
  if (!idValidacao.ok) {
    throw new AppError(400, idValidacao.mensagem, 'ID_INVALIDO', idValidacao.detalhes);
  }

  const id = idValidacao.dados.id;
  if (id === req.session.adminId) {
    throw new AppError(409, 'Voce nao pode excluir o proprio usuario logado.', 'AUTO_EXCLUSAO_INVALIDA');
  }

  const [atuais] = await pool.query('SELECT id, usuario, role, ativo FROM usuarios WHERE id = ?', [id]);
  const atual = atuais[0];
  if (!atual) {
    throw new AppError(404, 'Usuario nao encontrado.', 'USUARIO_NAO_ENCONTRADO');
  }

  if (atual.role === 'ADMIN' && atual.ativo) {
    const outrosAdmins = await contarAdminsAtivos(id);
    if (outrosAdmins === 0) {
      throw new AppError(409, 'Mantenha pelo menos um usuario ADMIN ativo.', 'ULTIMO_ADMIN');
    }
  }

  await pool.query('DELETE FROM usuarios WHERE id = ?', [id]);

  logger.info('admin.usuario_excluido', {
    adminId: req.session.adminId,
    usuarioId: id,
    usuario: atual.usuario,
    ...dadosRequisicao(req)
  });
  await registrarAuditoria(pool, {
    evento: 'admin.usuario_excluido',
    entidade: 'usuario',
    entidadeId: id,
    detalhes: { usuario: atual.usuario, role: atual.role },
    ...dadosAuditoria(req)
  });

  res.json({ ok: true });
}));

router.patch('/senha', exigirLogin, asyncHandler(async (req, res) => {
  const validacao = validarAlteracaoSenha(req.body);
  if (!validacao.ok) {
    throw new AppError(400, validacao.mensagem, 'VALIDACAO_SENHA', validacao.detalhes);
  }
  const { senhaAtual, novaSenha } = validacao.dados;

  const errosSenha = validarSenhaForte(novaSenha);
  if (errosSenha.length > 0) {
    throw new AppError(400, mensagemSenhaForte(errosSenha), 'SENHA_FRACA', errosSenha);
  }

  let rows;
  try {
    [rows] = await pool.query(
      'SELECT id, usuario, senha_hash FROM usuarios WHERE id = ? AND ativo = 1',
      [req.session.adminId]
    );
  } catch (err) {
    if (err.code !== 'ER_NO_SUCH_TABLE') throw err;
    [rows] = await pool.query(
      'SELECT id, usuario, senha_hash FROM admins WHERE id = ? AND ativo = 1',
      [req.session.adminId]
    );
  }
  const admin = rows[0];
  if (!admin) {
    req.session.destroy(() => {});
    throw new AppError(401, 'Sessao expirada ou administrador inativo.', 'NAO_AUTENTICADO');
  }

  const senhaCorreta = await bcrypt.compare(senhaAtual, admin.senha_hash);
  if (!senhaCorreta) {
    logger.warn('admin.alterar_senha_falhou', {
      adminId: admin.id,
      usuario: admin.usuario,
      motivo: 'senha_atual_invalida',
      ...dadosRequisicao(req)
    });
    throw new AppError(401, 'Senha atual invalida.', 'SENHA_ATUAL_INVALIDA');
  }

  const senhaHash = await bcrypt.hash(novaSenha, 10);
  try {
    await pool.query('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [senhaHash, admin.id]);
  } catch (err) {
    if (err.code !== 'ER_NO_SUCH_TABLE') throw err;
    await pool.query('UPDATE admins SET senha_hash = ? WHERE id = ?', [senhaHash, admin.id]);
  }

  logger.info('admin.senha_alterada', {
    adminId: admin.id,
    usuario: admin.usuario,
    ...dadosRequisicao(req)
  });

  res.json({ ok: true });
}));

router.get('/agendamentos', exigirLogin, asyncHandler(async (req, res) => {
  const dominios = await listarDominios(pool);
  const validacao = validarFiltrosAgenda(req.query, dominios);
  if (!validacao.ok) {
    throw new AppError(400, validacao.mensagem, 'VALIDACAO_FILTROS_AGENDA', validacao.detalhes);
  }
  const { data, ubs, tipo_medicamento, busca, status } = validacao.dados;

  const temBusca = Boolean(busca && busca.trim());
  if (temBusca && busca.trim().length < 2) {
    throw new AppError(400, 'Informe pelo menos 2 caracteres para buscar paciente.', 'BUSCA_CURTA');
  }

  const condicoes = [];
  const parametros = [];

  if (!temBusca) {
    condicoes.push('data_agendamento = ?');
    parametros.push(data);
  }

  if (ubs) {
    condicoes.push('ubs = ?');
    parametros.push(ubs);
  }
  if (tipo_medicamento) {
    condicoes.push('tipo_medicamento = ?');
    parametros.push(tipo_medicamento);
  }
  if (status) {
    condicoes.push('status = ?');
    parametros.push(status);
  }
  if (temBusca) {
    const digitos = busca.replace(/\D/g, '');
    condicoes.push('(nome_completo LIKE ? OR cpf LIKE ? OR telefone LIKE ?)');
    parametros.push(`%${busca}%`, `${digitos || busca}%`, `${digitos || busca}%`);
  }

  const [rows] = await pool.query(
    `SELECT a.id, a.nome_completo, a.cpf,
            DATE_FORMAT(a.data_nascimento, '%Y-%m-%d') AS data_nascimento,
            a.endereco, a.telefone, a.email, a.ubs, a.tipo_medicamento,
            a.primeiro_atendimento,
            DATE_FORMAT(a.previsao_termino, '%Y-%m-%d') AS previsao_termino,
            a.observacoes,
            a.receita_arquivo,
            DATE_FORMAT(a.data_agendamento, '%Y-%m-%d') AS data_agendamento,
            TIME_FORMAT(a.horario, '%H:%i') AS horario,
            a.vagas_ocupadas, a.encaixe, a.status,
      DATE_FORMAT(a.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
      a.updated_by,
      DATE_FORMAT(a.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
      DATE_FORMAT(a.atendido_em, '%Y-%m-%d %H:%i:%s') AS atendido_em,
      DATE_FORMAT(a.presente_em, '%Y-%m-%d %H:%i:%s') AS presente_em,
      u.nome AS atendido_por_nome,
      up.nome AS presente_por_nome
     FROM agendamentos a
     LEFT JOIN usuarios u ON a.atendido_por = u.id
     LEFT JOIN usuarios up ON a.presente_por = up.id
     WHERE ${condicoes.map(c => c.replace(/([a-zA-Z_]+ =)/, 'a.$1').replace(/([a-zA-Z_]+ LIKE)/, 'a.$1')).join(' AND ')}
     ORDER BY ${temBusca ? 'a.data_agendamento DESC, a.horario DESC, a.id DESC' : 'a.horario, a.id'}
     LIMIT ?`,
    [...parametros, temBusca ? 300 : 500]
  );

  res.json({ agendamentos: rows });
}));

router.post('/agendamentos', exigirLogin, asyncHandler(async (req, res) => {
  const dominios = await listarDominios(pool);
  const validacao = validarNovoAgendamentoAdmin(req.body, dominios);
  if (!validacao.ok) {
    throw new AppError(400, validacao.mensagem, 'VALIDACAO_AGENDAMENTO', validacao.detalhes);
  }
  const { encaixe, ...dadosAgendamento } = validacao.dados;

  try {
    const id = await slots.criarAgendamento(pool, dadosAgendamento, { encaixe, adminId: req.session.adminId });
    const [rows] = await pool.query(
      `SELECT id, nome_completo, cpf, email, ubs, tipo_medicamento, primeiro_atendimento,
              DATE_FORMAT(data_agendamento, '%Y-%m-%d') AS data_agendamento,
              TIME_FORMAT(horario, '%H:%i') AS horario,
              observacoes, encaixe
       FROM agendamentos
       WHERE id = ?`,
      [id]
    );
    const agendamento = rows[0];
    const resultadoEmail = await enfileirarConfirmacao(pool, agendamento);

    logger.info('admin.agendamento_criado', {
      adminId: req.session.adminId,
      agendamentoId: agendamento.id,
      data: agendamento.data_agendamento,
      horario: agendamento.horario,
      encaixe: Boolean(encaixe),
      ...dadosRequisicao(req)
    });
    await registrarAuditoria(pool, {
      evento: 'admin.agendamento_criado',
      entidade: 'agendamento',
      entidadeId: agendamento.id,
      detalhes: {
        nomeCompleto: agendamento.nome_completo,
        cpf: agendamento.cpf,
        data: agendamento.data_agendamento,
        horario: agendamento.horario,
        encaixe: Boolean(encaixe)
      },
      ...dadosAuditoria(req)
    });

    res.status(201).json({ ok: true, agendamento, encaixe: Boolean(encaixe), email: resultadoEmail });
  } catch (err) {
    if (err.codigo) {
      throw new AppError(409, err.message, err.codigo);
    }
    throw err;
  }
}));

router.get('/agendamentos/:id/receita', exigirLogin, asyncHandler(async (req, res, next) => {
  const idValidacao = validarId(req.params);
  if (!idValidacao.ok) {
    throw new AppError(400, idValidacao.mensagem, 'ID_INVALIDO', idValidacao.detalhes);
  }

  const [rows] = await pool.query('SELECT receita_arquivo FROM agendamentos WHERE id = ?', [idValidacao.dados.id]);
  const nomeArquivo = rows[0]?.receita_arquivo;
  if (!nomeArquivo) {
    throw new AppError(404, 'Nenhuma receita anexada a este agendamento.', 'RECEITA_NAO_ENCONTRADA');
  }

  res.sendFile(path.join(DIRETORIO_RECEITAS, nomeArquivo), (err) => {
    if (err && !res.headersSent) {
      next(new AppError(404, 'Arquivo da receita nao encontrado.', 'RECEITA_NAO_ENCONTRADA'));
    }
  });
}));

router.get('/pacientes', exigirLogin, asyncHandler(async (req, res) => {
  const validacao = validarBuscaPaciente(req.query);
  if (!validacao.ok) {
    throw new AppError(400, validacao.mensagem, 'VALIDACAO_BUSCA_PACIENTE', validacao.detalhes);
  }
  const { busca } = validacao.dados;
  const digitos = busca.replace(/\D/g, '');
  const termoTexto = `%${busca}%`;
  const termoDigitos = `%${digitos || busca}%`;

  const [rows] = await pool.query(
    `SELECT p.cpf, p.nome_completo,
            DATE_FORMAT(p.data_nascimento, '%Y-%m-%d') AS data_nascimento,
            p.telefone, p.email, p.ubs,
            COUNT(a.id) AS total_agendamentos,
            MAX(a.data_agendamento) AS ultima_data
     FROM pacientes p
     LEFT JOIN agendamentos a ON a.cpf = p.cpf
     WHERE p.nome_completo LIKE ? OR p.cpf LIKE ? OR p.telefone LIKE ?
     GROUP BY p.cpf, p.nome_completo, p.data_nascimento, p.telefone, p.email, p.ubs
     ORDER BY p.nome_completo
     LIMIT 20`,
    [termoTexto, termoDigitos, termoDigitos]
  );

  const [agendamentos] = await pool.query(
    `SELECT id, cpf, nome_completo,
            DATE_FORMAT(data_agendamento, '%Y-%m-%d') AS data_agendamento,
            TIME_FORMAT(horario, '%H:%i') AS horario,
            tipo_medicamento, status
     FROM agendamentos
     WHERE nome_completo LIKE ? OR cpf LIKE ? OR telefone LIKE ?
     ORDER BY data_agendamento DESC, horario DESC
     LIMIT 30`,
    [termoTexto, termoDigitos, termoDigitos]
  );

  res.json({ pacientes: rows, agendamentos });
}));

router.get('/horarios-disponiveis', exigirLogin, asyncHandler(async (req, res) => {
  const validacao = validarHorariosAdmin(req.query);
  if (!validacao.ok) {
    throw new AppError(400, validacao.mensagem, 'VALIDACAO_HORARIOS', validacao.detalhes);
  }
  const { data, primeiroAtendimento, agendamentoId } = validacao.dados;

  if (!slots.ehDiaUtil(data)) {
    return res.json({ blocos: [] });
  }

  const blocos = await slots.horariosDisponiveis(pool, data, primeiroAtendimento === 'true', agendamentoId || null);
  res.json({ blocos });
}));

router.patch('/agendamentos/:id/reagendar', exigirLogin, asyncHandler(async (req, res) => {
  const idValidacao = validarId(req.params);
  if (!idValidacao.ok) {
    throw new AppError(400, idValidacao.mensagem, 'ID_INVALIDO', idValidacao.detalhes);
  }

  const validacao = validarReagendamento(req.body);
  if (!validacao.ok) {
    throw new AppError(400, validacao.mensagem, 'VALIDACAO_REAGENDAMENTO', validacao.detalhes);
  }

  try {
    const resultado = await slots.reagendarAgendamento(
      pool,
      idValidacao.dados.id,
      validacao.dados.data_agendamento,
      validacao.dados.horario,
      req.session.adminId
    );
    if (!resultado.encontrado) {
      throw new AppError(404, 'Agendamento nao encontrado.', 'AGENDAMENTO_NAO_ENCONTRADO');
    }

    logger.info('agendamento.reagendado', {
      adminId: req.session.adminId,
      agendamentoId: idValidacao.dados.id,
      dataAnterior: resultado.dataAnterior,
      horarioAnterior: resultado.horarioAnterior,
      dataNova: resultado.dataNova,
      horarioNovo: resultado.horarioNovo,
      historicoPreservado: Boolean(resultado.historicoPreservado),
      novoAgendamentoId: resultado.novoAgendamentoId || null,
      ...dadosRequisicao(req)
    });
    if (!resultado.semAlteracao) {
      await registrarAuditoria(pool, {
        evento: 'agendamento.reagendado',
        entidade: 'agendamento',
        entidadeId: idValidacao.dados.id,
        detalhes: {
          dataAnterior: resultado.dataAnterior,
          horarioAnterior: resultado.horarioAnterior,
          dataNova: resultado.dataNova,
          horarioNovo: resultado.horarioNovo,
          // Reagendamento de atendido nao move o registro: gera um agendamento novo.
          ...(resultado.historicoPreservado ? { novoAgendamentoId: resultado.novoAgendamentoId } : {})
        },
        ...dadosAuditoria(req)
      });
    }

    res.json({ ok: true, resultado });
  } catch (err) {
    if (err.codigo) {
      throw new AppError(409, err.message, err.codigo);
    }
    throw err;
  }
}));

router.patch('/agendamentos/:id', exigirLogin, asyncHandler(async (req, res) => {
  const idValidacao = validarId(req.params);
  if (!idValidacao.ok) {
    throw new AppError(400, idValidacao.mensagem, 'ID_INVALIDO', idValidacao.detalhes);
  }

  const validacao = validarStatus(req.body);
  if (!validacao.ok) {
    throw new AppError(400, validacao.mensagem, 'STATUS_INVALIDO', validacao.detalhes);
  }
  const { status } = validacao.dados;

  const resultado = await slots.atualizarStatusAgendamento(pool, idValidacao.dados.id, status, req.session.adminId);
  if (!resultado.encontrado) {
    throw new AppError(404, 'Agendamento nao encontrado.', 'AGENDAMENTO_NAO_ENCONTRADO');
  }

  logger.info('agendamento.status_atualizado', {
    adminId: req.session.adminId,
    agendamentoId: idValidacao.dados.id,
    statusAnterior: resultado.statusAnterior,
    statusNovo: resultado.statusNovo,
    ...dadosRequisicao(req)
  });
  await registrarAuditoria(pool, {
    evento: 'agendamento.status_atualizado',
    entidade: 'agendamento',
    entidadeId: idValidacao.dados.id,
    detalhes: {
      statusAnterior: resultado.statusAnterior,
      statusNovo: resultado.statusNovo
    },
    ...dadosAuditoria(req)
  });

  res.json({ ok: true });
}));

router.get('/relatorios/agendamentos', exigirLogin, asyncHandler(async (req, res) => {
  const dominios = await listarDominios(pool);
  const validacao = validarRelatorioAgendamentos(req.query, dominios);
  if (!validacao.ok) {
    throw new AppError(400, validacao.mensagem, 'VALIDACAO_RELATORIO_AGENDAMENTOS', validacao.detalhes);
  }

  const filtros = [];
  const parametros = [];
  const { data_inicio: dataInicio, data_fim: dataFim, ubs, tipo_medicamento: tipoMedicamento, status } = validacao.dados;

  if (dataInicio) {
    filtros.push('a.data_agendamento >= ?');
    parametros.push(dataInicio);
  }
  if (dataFim) {
    filtros.push('a.data_agendamento <= ?');
    parametros.push(dataFim);
  }
  if (ubs) {
    filtros.push('a.ubs = ?');
    parametros.push(ubs);
  }
  if (tipoMedicamento) {
    filtros.push('a.tipo_medicamento = ?');
    parametros.push(tipoMedicamento);
  }
  if (status) {
    filtros.push('a.status = ?');
    parametros.push(status);
  }

  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  const bloqueiosWhere = [
    dataInicio ? 'data_agendamento >= ?' : '',
    dataFim ? 'data_agendamento <= ?' : ''
  ].filter(Boolean);
  const bloqueiosParametros = [dataInicio, dataFim].filter(Boolean);

  const [[totais]] = await pool.query(
    `SELECT COUNT(*) AS total,
            SUM(a.status = 'confirmado') AS confirmados,
            SUM(a.status = 'atendido') AS atendidos,
            SUM(a.status = 'faltou') AS faltas,
            SUM(a.status = 'cancelado') AS cancelados,
            COALESCE(SUM(CASE WHEN a.status <> 'cancelado' THEN a.vagas_ocupadas ELSE 0 END), 0) AS vagas_ocupadas
       FROM agendamentos a
       ${where}`,
    parametros
  );

  await slots.garantirTabelaBloqueios(pool);

  const [porDia] = await pool.query(
    `SELECT DATE_FORMAT(a.data_agendamento, '%Y-%m-%d') AS data,
            COUNT(*) AS total,
            SUM(a.status = 'atendido') AS atendidos,
            SUM(a.status = 'faltou') AS faltas,
            SUM(a.status = 'cancelado') AS cancelados
       FROM agendamentos a
       ${where}
       GROUP BY a.data_agendamento
       ORDER BY a.data_agendamento`,
    parametros
  );

  const [porUbs] = await pool.query(
    `SELECT a.ubs AS nome, COUNT(*) AS total
       FROM agendamentos a
       ${where}
       GROUP BY a.ubs
       ORDER BY total DESC, a.ubs`,
    parametros
  );

  const [porMedicamento] = await pool.query(
    `SELECT a.tipo_medicamento AS nome, COUNT(*) AS total
       FROM agendamentos a
       ${where}
       GROUP BY a.tipo_medicamento
       ORDER BY total DESC, a.tipo_medicamento`,
    parametros
  );

  const [[bloqueios]] = await pool.query(
    `SELECT COUNT(*) AS total
       FROM bloqueios_agenda
       ${bloqueiosWhere.length ? `WHERE ${bloqueiosWhere.join(' AND ')}` : ''}`,
    bloqueiosParametros
  );

  res.json({
    filtros: validacao.dados,
    totais: {
      agendamentos: Number(totais.total || 0),
      confirmados: Number(totais.confirmados || 0),
      atendidos: Number(totais.atendidos || 0),
      faltas: Number(totais.faltas || 0),
      cancelados: Number(totais.cancelados || 0),
      horariosBloqueados: Number(bloqueios.total || 0),
      vagasOcupadas: Number(totais.vagas_ocupadas || 0)
    },
    porDia: porDia.map((item) => ({
      data: item.data,
      total: Number(item.total || 0),
      atendidos: Number(item.atendidos || 0),
      faltas: Number(item.faltas || 0),
      cancelados: Number(item.cancelados || 0)
    })),
    porUbs: porUbs.map((item) => ({ nome: item.nome, total: Number(item.total || 0) })),
    porMedicamento: porMedicamento.map((item) => ({ nome: item.nome, total: Number(item.total || 0) }))
  });
}));

router.get('/agendamentos/exportar', exigirLogin, asyncHandler(async (req, res) => {
  const dominios = await listarDominios(pool);
  
  // We can receive filters from Agenda (data, busca) or from Relatorios (data_inicio, data_fim)
  const query = req.query;
  const { data, data_inicio, data_fim, ubs, tipo_medicamento, status, busca } = query;

  const filtros = [];
  const parametros = [];

  if (data_inicio) {
    filtros.push('a.data_agendamento >= ?');
    parametros.push(data_inicio);
  } else if (data && !busca) {
    filtros.push('a.data_agendamento = ?');
    parametros.push(data);
  }

  if (data_fim) {
    filtros.push('a.data_agendamento <= ?');
    parametros.push(data_fim);
  }

  if (ubs) {
    filtros.push('a.ubs = ?');
    parametros.push(ubs);
  }
  if (tipo_medicamento) {
    filtros.push('a.tipo_medicamento = ?');
    parametros.push(tipo_medicamento);
  }
  if (status) {
    filtros.push('a.status = ?');
    parametros.push(status);
  }

  const temBusca = Boolean(busca && busca.trim());
  if (temBusca) {
    const digitos = busca.replace(/\\D/g, '');
    filtros.push('(a.nome_completo LIKE ? OR a.cpf LIKE ? OR a.telefone LIKE ?)');
    parametros.push(`%${busca}%`, `${digitos || busca}%`, `${digitos || busca}%`);
  }

  const where = filtros.length > 0 ? `WHERE ${filtros.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT a.id, a.nome_completo, a.cpf,
            DATE_FORMAT(a.data_nascimento, '%d/%m/%Y') AS data_nascimento,
            a.endereco, a.telefone, a.email, a.ubs, a.tipo_medicamento,
            a.primeiro_atendimento,
            DATE_FORMAT(a.previsao_termino, '%d/%m/%Y') AS previsao_termino,
            a.observacoes,
            DATE_FORMAT(a.data_agendamento, '%d/%m/%Y') AS data_agendamento,
            TIME_FORMAT(a.horario, '%H:%i') AS horario,
            a.vagas_ocupadas, a.encaixe, a.status,
            DATE_FORMAT(a.atendido_em, '%d/%m/%Y %H:%i:%s') AS atendido_em,
            DATE_FORMAT(a.presente_em, '%d/%m/%Y %H:%i:%s') AS presente_em,
            u.nome AS atendido_por_nome,
            up.nome AS presente_por_nome
     FROM agendamentos a
     LEFT JOIN usuarios u ON a.atendido_por = u.id
     LEFT JOIN usuarios up ON a.presente_por = up.id
     ${where}
     ORDER BY a.data_agendamento DESC, a.horario ASC, a.id ASC`,
    parametros
  );

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Lista de Presença');

  worksheet.columns = [
    { header: 'Data', key: 'data_agendamento', width: 12 },
    { header: 'Horário', key: 'horario', width: 10 },
    { header: 'Paciente', key: 'nome_completo', width: 35 },
    { header: 'CPF', key: 'cpf', width: 16 },
    { header: 'Telefone', key: 'telefone', width: 16 },
    { header: 'UBS Origem', key: 'ubs', width: 30 },
    { header: 'Medicamento', key: 'tipo_medicamento', width: 25 },
    { header: '1º Atendimento', key: 'primeiro_atendimento', width: 15 },
    { header: 'Encaixe', key: 'encaixe', width: 12 },
    { header: 'Chegada Em', key: 'presente_em', width: 20 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Atendido Por', key: 'atendido_por_nome', width: 25 },
    { header: 'Atendido Em', key: 'atendido_em', width: 20 },
    { header: 'Observações', key: 'observacoes', width: 40 }
  ];

  worksheet.getRow(1).font = { bold: true };

  rows.forEach((row) => {
    worksheet.addRow({
      data_agendamento: row.data_agendamento,
      horario: row.horario,
      nome_completo: row.nome_completo,
      cpf: row.cpf,
      telefone: row.telefone,
      ubs: row.ubs,
      tipo_medicamento: row.tipo_medicamento,
      primeiro_atendimento: row.primeiro_atendimento ? 'Sim' : 'Não',
      encaixe: row.encaixe ? 'Sim' : 'Não',
      presente_em: row.presente_em || '',
      status: row.status,
      atendido_por_nome: row.atendido_por_nome || '',
      atendido_em: row.atendido_em || '',
      observacoes: row.observacoes || ''
    });
  });

  function formatarDataArquivo(dataISO) {
    const [ano, mes, diaDoMes] = String(dataISO).slice(0, 10).split('-');
    return `${diaDoMes}_${mes}_${ano}`;
  }

  let sufixoArquivo;
  if (data) {
    sufixoArquivo = formatarDataArquivo(data);
  } else if (data_inicio && data_fim) {
    sufixoArquivo = data_inicio === data_fim
      ? formatarDataArquivo(data_inicio)
      : `${formatarDataArquivo(data_inicio)}_a_${formatarDataArquivo(data_fim)}`;
  } else if (data_inicio) {
    sufixoArquivo = `a_partir_de_${formatarDataArquivo(data_inicio)}`;
  } else if (data_fim) {
    sufixoArquivo = `ate_${formatarDataArquivo(data_fim)}`;
  } else {
    sufixoArquivo = formatarDataArquivo(dataHojeISO());
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="agenda-${sufixoArquivo}.xlsx"`);

  await workbook.xlsx.write(res);
  res.end();
}));

router.get('/bloqueios/resumo-mes', exigirLogin, exigirAdministrador, asyncHandler(async (req, res) => {
  const dataInicio = String(req.query.data_inicio || '');
  const dataFim = String(req.query.data_fim || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
    throw new AppError(400, 'Parametros "data_inicio" e "data_fim" devem estar no formato YYYY-MM-DD.', 'VALIDACAO_BLOQUEIOS');
  }

  const resumo = await slots.resumoBloqueiosPorMes(pool, dataInicio, dataFim);
  res.json({ resumo });
}));

router.get('/bloqueios', exigirLogin, exigirAdministrador, asyncHandler(async (req, res) => {
  const data = String(req.query.data || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw new AppError(400, 'Parametro "data" deve estar no formato YYYY-MM-DD.', 'VALIDACAO_BLOQUEIOS');
  }

  await slots.garantirTabelaBloqueios(pool);

  let rows;
  try {
    // Tenta com JOIN na tabela usuarios (nova estrutura)
    [rows] = await pool.query(
      `SELECT b.id,
              DATE_FORMAT(b.data_agendamento, '%Y-%m-%d') AS data_agendamento,
              TIME_FORMAT(b.horario, '%H:%i') AS horario,
              b.motivo,
              b.created_at,
              u.nome AS admin_nome
       FROM bloqueios_agenda b
       LEFT JOIN usuarios u ON u.id = b.admin_id
       WHERE b.data_agendamento = ?
       ORDER BY b.horario`,
      [data]
    );
  } catch (err) {
    if (err.code !== 'ER_NO_SUCH_TABLE') throw err;
    // Fallback: tabela usuarios ainda nao existe, busca sem JOIN
    [rows] = await pool.query(
      `SELECT b.id,
              DATE_FORMAT(b.data_agendamento, '%Y-%m-%d') AS data_agendamento,
              TIME_FORMAT(b.horario, '%H:%i') AS horario,
              b.motivo,
              b.created_at,
              NULL AS admin_nome
       FROM bloqueios_agenda b
       WHERE b.data_agendamento = ?
       ORDER BY b.horario`,
      [data]
    );
  }
  res.json({ bloqueios: rows });
}));

router.post('/bloqueios', exigirLogin, exigirAdministrador, asyncHandler(async (req, res) => {
  const validacao = validarBloqueio(req.body);
  if (!validacao.ok) {
    throw new AppError(400, validacao.mensagem, 'VALIDACAO_BLOQUEIO', validacao.detalhes);
  }

  try {
    const resultado = await slots.bloquearHorario(
      pool,
      validacao.dados.data_agendamento,
      validacao.dados.horario,
      validacao.dados.motivo,
      req.session.adminId
    );

    logger.info('agenda.horario_bloqueado', {
      adminId: req.session.adminId,
      data: resultado.data,
      horario: resultado.horario,
      ...dadosRequisicao(req)
    });
    await registrarAuditoria(pool, {
      evento: 'agenda.horario_bloqueado',
      entidade: 'bloqueio_agenda',
      entidadeId: `${resultado.data} ${resultado.horario}`,
      detalhes: {
        data: resultado.data,
        horario: resultado.horario,
        motivo: validacao.dados.motivo || null
      },
      ...dadosAuditoria(req)
    });

    res.status(201).json({ ok: true, bloqueio: resultado });
  } catch (err) {
    if (err.codigo) {
      throw new AppError(409, err.message, err.codigo);
    }
    throw err;
  }
}));

router.delete('/bloqueios/:id', exigirLogin, exigirAdministrador, asyncHandler(async (req, res) => {
  const idValidacao = validarId(req.params);
  if (!idValidacao.ok) {
    throw new AppError(400, idValidacao.mensagem, 'ID_INVALIDO', idValidacao.detalhes);
  }

  const resultado = await slots.desbloquearHorario(pool, idValidacao.dados.id);
  if (!resultado.encontrado) {
    throw new AppError(404, 'Bloqueio nao encontrado.', 'BLOQUEIO_NAO_ENCONTRADO');
  }

  logger.info('agenda.horario_desbloqueado', {
    adminId: req.session.adminId,
    data: resultado.data,
    horario: resultado.horario,
    ...dadosRequisicao(req)
  });
  await registrarAuditoria(pool, {
    evento: 'agenda.horario_desbloqueado',
    entidade: 'bloqueio_agenda',
    entidadeId: idValidacao.dados.id,
    detalhes: {
      data: resultado.data,
      horario: resultado.horario
    },
    ...dadosAuditoria(req)
  });

  res.json({ ok: true });
}));

router.get('/dias-bloqueados', exigirLogin, exigirAdministrador, asyncHandler(async (req, res) => {
  const dataInicio = req.query.data_inicio ? String(req.query.data_inicio) : null;
  const dataFim = req.query.data_fim ? String(req.query.data_fim) : null;
  if (dataInicio && !/^\d{4}-\d{2}-\d{2}$/.test(dataInicio)) {
    throw new AppError(400, 'Parametro "data_inicio" deve estar no formato YYYY-MM-DD.', 'VALIDACAO_DIAS_BLOQUEADOS');
  }
  if (dataFim && !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
    throw new AppError(400, 'Parametro "data_fim" deve estar no formato YYYY-MM-DD.', 'VALIDACAO_DIAS_BLOQUEADOS');
  }

  const diasBloqueados = await slots.listarDiasBloqueados(pool, dataInicio, dataFim);
  res.json({ diasBloqueados });
}));

router.post('/dias-bloqueados', exigirLogin, exigirAdministrador, asyncHandler(async (req, res) => {
  const validacao = validarDiaBloqueado(req.body);
  if (!validacao.ok) {
    throw new AppError(400, validacao.mensagem, 'VALIDACAO_DIA_BLOQUEADO', validacao.detalhes);
  }

  try {
    const resultado = await slots.bloquearDia(
      pool,
      validacao.dados.data_agendamento,
      validacao.dados.motivo,
      req.session.adminId
    );

    logger.info('agenda.dia_bloqueado', {
      adminId: req.session.adminId,
      data: resultado.data,
      ...dadosRequisicao(req)
    });
    await registrarAuditoria(pool, {
      evento: 'agenda.dia_bloqueado',
      entidade: 'dia_bloqueado',
      entidadeId: resultado.data,
      detalhes: {
        data: resultado.data,
        motivo: validacao.dados.motivo || null
      },
      ...dadosAuditoria(req)
    });

    res.status(201).json({ ok: true, diaBloqueado: resultado });
  } catch (err) {
    if (err.codigo) {
      throw new AppError(409, err.message, err.codigo);
    }
    throw err;
  }
}));

router.delete('/dias-bloqueados/:id', exigirLogin, exigirAdministrador, asyncHandler(async (req, res) => {
  const idValidacao = validarId(req.params);
  if (!idValidacao.ok) {
    throw new AppError(400, idValidacao.mensagem, 'ID_INVALIDO', idValidacao.detalhes);
  }

  const resultado = await slots.desbloquearDia(pool, idValidacao.dados.id);
  if (!resultado.encontrado) {
    throw new AppError(404, 'Bloqueio de dia nao encontrado.', 'DIA_BLOQUEADO_NAO_ENCONTRADO');
  }

  logger.info('agenda.dia_desbloqueado', {
    adminId: req.session.adminId,
    data: resultado.data,
    ...dadosRequisicao(req)
  });
  await registrarAuditoria(pool, {
    evento: 'agenda.dia_desbloqueado',
    entidade: 'dia_bloqueado',
    entidadeId: resultado.data,
    detalhes: {
      data: resultado.data
    },
    ...dadosAuditoria(req)
  });

  res.json({ ok: true });
}));

router.get('/logs', exigirLogin, exigirAdministrador, asyncHandler(async (req, res) => {
  const validacao = validarLogsAdmin(req.query);
  if (!validacao.ok) {
    throw new AppError(400, validacao.mensagem, 'VALIDACAO_LOGS', validacao.detalhes);
  }

  const logs = await listarAuditoria(pool, validacao.dados);
  res.json({ logs });
}));

module.exports = router;
