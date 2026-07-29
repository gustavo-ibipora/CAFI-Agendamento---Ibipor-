import { useEffect, useRef, useState } from 'react';
import { apiJson, jsonOptions } from '../api.js';
import { senhaForteValida } from '../utils.js';
import Message from '../components/Message.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useNavigate, Link } from 'react-router-dom';

const estadoInicial = {
  nome: '',
  usuario: '',
  role: 'OPERADOR',
  senha: '',
  confirmarSenha: ''
};

const ROTULOS_ROLE = {
  ADMIN: 'Admin',
  OPERADOR: 'Operador'
};

export default function AdminCreateUserPage({ setHeaderNav, setCanManageUsers, embedded = false }) {
  const formRef = useRef(null);
  const [form, setForm] = useState(estadoInicial);
  const [formKey, setFormKey] = useState(0);
  const [editandoId, setEditandoId] = useState(null);
  const navigate = useNavigate();
  const [nomeAdmin, setNomeAdmin] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [usuarioExcluir, setUsuarioExcluir] = useState(null);
  // Enquanto verifica sessão/permissão, não renderiza conteúdo
  const [verificado, setVerificado] = useState(false);

  useEffect(() => {
    if (embedded) {
      setCanManageUsers?.(true);
      setVerificado(true);
      carregarUsuarios()
        .catch((err) => {
          if (err.status === 401) {
            navigate('/admin/login');
            return;
          }
          if (err.status === 403) {
            setErro('Você não tem permissão para gerenciar usuários.');
            return;
          }
          setErro(err.message || 'Não foi possível carregar os usuários.');
        })
        .finally(() => setCarregando(false));
      return;
    }

    verificarPermissaoECarregar();
  }, [embedded]);

  useEffect(() => {
    if (embedded) return undefined;

    setHeaderNav?.(
      <div className="admin-nav">
        <span>{nomeAdmin}</span>
        <Link className="botao secundario botao-topo" to="/admin/alterar-senha">Senha</Link>
        <button type="button" className="secundario botao-topo" disabled={saindo} onClick={sair}>
          {saindo ? 'Saindo...' : 'Sair'}
        </button>
      </div>
    );

    return () => setHeaderNav?.(null);
  }, [embedded, nomeAdmin, saindo]);

  function atualizar(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  function limparFormulario() {
    setForm(estadoInicial);
    setEditandoId(null);
    setFormKey((valor) => valor + 1);
    formRef.current?.reset();
  }

  function editarUsuario(usuario) {
    setErro('');
    setSucesso('');
    setEditandoId(usuario.id);
    setForm({
      nome: usuario.nome || '',
      usuario: usuario.usuario || '',
      role: usuario.role || 'OPERADOR',
      ativo: Boolean(usuario.ativo),
      senha: '',
      confirmarSenha: ''
    });
    setFormKey((valor) => valor + 1);
  }

  async function verificarPermissaoECarregar() {
    setCarregando(true);
    try {
      const sessao = await apiJson('/api/admin/sessao');
      if (sessao.role !== 'ADMIN') {
        navigate('/admin/agenda');
        return;
      }
      setNomeAdmin(sessao.nome);
      setCanManageUsers?.(true);
      setVerificado(true);
      await carregarUsuarios();
    } catch (err) {
      navigate('/admin/login');
    } finally {
      setCarregando(false);
    }
  }

  async function sair() {
    setSaindo(true);
    try {
      await apiJson('/api/admin/logout', { method: 'POST' });
    } catch (err) {
      // Mesmo se o logout falhar, voltar para o login evita deixar a sessão exposta no navegador.
    } finally {
      navigate('/admin/login');
    }
  }

  async function carregarUsuarios() {
    const dados = await apiJson('/api/admin/usuarios');
    setUsuarios(dados.usuarios || []);
  }

  async function salvar(evento) {
    evento.preventDefault();
    setErro('');
    setSucesso('');

    const editando = Boolean(editandoId);

    if (!form.nome.trim() || !form.usuario.trim()) {
      setErro('Informe nome e usuário.');
      return;
    }
    if (!editando && !form.senha) {
      setErro('Informe uma senha.');
      return;
    }
    if (form.senha !== form.confirmarSenha) {
      setErro('A confirmação da senha não confere.');
      return;
    }
    if (form.senha && !senhaForteValida(form.senha)) {
      setErro('A senha deve ter pelo menos 10 caracteres, letra maiúscula, letra minúscula, número e caractere especial.');
      return;
    }

    setSalvando(true);
    try {
      const payload = {
        nome: form.nome.trim(),
        usuario: form.usuario.trim(),
        role: form.role,
        senha: form.senha
      };

      if (editando) {
        payload.ativo = Boolean(form.ativo);
        await apiJson(`/api/admin/usuarios/${editandoId}`, jsonOptions(payload, 'PUT'));
        setSucesso(`Usuário "${payload.usuario}" atualizado com sucesso.`);
      } else {
        const dados = await apiJson('/api/admin/usuarios', jsonOptions(payload));
        setSucesso(`Usuário "${dados.usuario.usuario}" criado com sucesso.`);
      }

      limparFormulario();
      await carregarUsuarios();
    } catch (err) {
      if (err.status === 401) {
        navigate('/admin/login');
        return;
      }
      if (err.status === 403) {
        navigate('/admin/agenda');
        return;
      }
      setErro(err.message || 'Não foi possível criar o usuário.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluirUsuario(usuario) {
    setUsuarioExcluir(null);
    setErro('');
    setSucesso('');
    try {
      await apiJson(`/api/admin/usuarios/${usuario.id}`, { method: 'DELETE' });
      if (editandoId === usuario.id) limparFormulario();
      setSucesso(`Usuário "${usuario.usuario}" excluído com sucesso.`);
      await carregarUsuarios();
    } catch (err) {
      if (err.status === 401) {
        navigate('/admin/login');
        return;
      }
      if (err.status === 403) {
        navigate('/admin/agenda');
        return;
      }
      setErro(err.message || 'Não foi possível excluir o usuário.');
    }
  }

  // Não renderiza nada enquanto verifica sessão (evita flash de conteúdo)
  if (!verificado) {
    const carregamento = (
      <div className="cartao">
        <p style={{ color: 'var(--cinza-suave)', textAlign: 'center', padding: '24px 0' }}>
          {carregando ? 'Verificando permissões...' : ''}
        </p>
      </div>
    );

    return embedded ? carregamento : <main className="pagina-usuarios">{carregamento}</main>;
  }

  const conteudo = (
    <>
      <section className="cartao">
        <h2>Gerenciar usuários</h2>
        <Message>{erro}</Message>
        <Message type="sucesso">{sucesso}</Message>

        <form key={formKey} ref={formRef} className="grade formulario-usuario" noValidate onSubmit={salvar}>
          <div className="campo largura-total">
            <label htmlFor="nome">Nome completo</label>
            <input id="nome" value={form.nome} maxLength="100" autoComplete="name" required onChange={(e) => atualizar('nome', e.target.value)} />
          </div>

          <div className="campo">
            <label htmlFor="usuario">Usuário</label>
            <input id="usuario" value={form.usuario} maxLength="60" autoComplete="username" required onChange={(e) => atualizar('usuario', e.target.value)} />
          </div>

          <div className="campo">
            <label htmlFor="role">Perfil</label>
            <select id="role" value={form.role} required onChange={(e) => atualizar('role', e.target.value)}>
              <option value="OPERADOR">Operador</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          <div className="campo">
            <label htmlFor="senha">Senha</label>
            <input type="password" id="senha" value={form.senha} autoComplete="new-password" required={!editandoId} onChange={(e) => atualizar('senha', e.target.value)} />
          </div>

          <div className="campo">
            <label htmlFor="confirmar-senha">Confirmar senha</label>
            <input type="password" id="confirmar-senha" value={form.confirmarSenha} autoComplete="new-password" required={!editandoId || Boolean(form.senha)} onChange={(e) => atualizar('confirmarSenha', e.target.value)} />
          </div>

          {editandoId && (
            <div className="campo largura-total">
              <label className="toggle-linha">
                <input type="checkbox" checked={Boolean(form.ativo)} onChange={(e) => atualizar('ativo', e.target.checked)} />
                Usuário ativo
              </label>
            </div>
          )}

          <div className="acoes largura-total">
            <button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : editandoId ? 'Salvar usuário' : 'Criar usuário'}</button>
            {editandoId && (
              <button type="button" className="secundario" onClick={limparFormulario}>Cancelar edição</button>
            )}
          </div>
        </form>
      </section>

      <section className="cartao">
        <h2>Usuários cadastrados</h2>
        {carregando ? (
          <p>Carregando usuários...</p>
        ) : (
          <div className="lista-usuarios-admin">
            {usuarios.map((item) => (
              <div className="usuario-admin-item" key={item.id}>
                <div>
                  <strong>{item.nome}</strong>
                  <span>{item.usuario} - {item.ativo ? 'Ativo' : 'Inativo'}</span>
                </div>
                <span className={`tag tag-role-${item.role.toLowerCase()}`}>{ROTULOS_ROLE[item.role] || item.role}</span>
                <div className="usuario-admin-acoes">
                  <button type="button" className="botao-tabela botao-detalhes" onClick={() => editarUsuario(item)}>Editar</button>
                  <button type="button" className="botao-tabela botao-cancelar" onClick={() => setUsuarioExcluir(item)}>Excluir</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );

  const dialogo = (
    <ConfirmDialog
      open={Boolean(usuarioExcluir)}
      title="Excluir usuário?"
      message={`O usuário "${usuarioExcluir?.usuario || ''}" será removido do sistema.`}
      confirmText="Excluir usuário"
      danger
      onCancel={() => setUsuarioExcluir(null)}
      onConfirm={() => excluirUsuario(usuarioExcluir)}
    />
  );

  return embedded
    ? <div className="painel-usuarios-admin">{conteudo}{dialogo}</div>
    : <main className="pagina-usuarios">{conteudo}{dialogo}</main>;
}
