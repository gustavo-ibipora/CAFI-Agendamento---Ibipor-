import { useState } from 'react';
import { apiJson, jsonOptions } from '../api.js';
import Message from '../components/Message.jsx';
import { useNavigate } from 'react-router-dom';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState(false);

  async function entrar(evento) {
    evento.preventDefault();
    setErro('');

    if (!usuario.trim() || !senha) {
      setErro('Informe usuário e senha.');
      return;
    }

    setEntrando(true);
    try {
      await apiJson('/api/admin/login', jsonOptions({ usuario: usuario.trim(), senha }));
      navigate('/admin/agenda');
    } catch (err) {
      setErro(err.message || 'Não foi possível entrar.');
    } finally {
      setEntrando(false);
    }
  }

  return (
    <main className="pagina-login">
      <h1 className="sr-only">Entrar no painel administrativo</h1>
      <form className="cartao" noValidate onSubmit={entrar}>
        <h2>Entrar</h2>
        <Message>{erro}</Message>

        <div className="campo">
          <label htmlFor="usuario">Usuário</label>
          <input type="text" id="usuario" value={usuario} maxLength="60" autoComplete="username" required autoFocus onChange={(e) => setUsuario(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="senha" >Senha</label>
          <input type="password" id="senha" value={senha} autoComplete="current-password" required onChange={(e) => setSenha(e.target.value)} />
        </div>
        <button className="botao-submit-login" type="submit" disabled={entrando}>{entrando ? 'Entrando...' : 'Entrar'}</button>
      </form>
    </main>
  );
}
