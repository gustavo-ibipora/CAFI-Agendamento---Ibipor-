import { useEffect, useState } from 'react';
import { apiJson, jsonOptions } from '../api.js';
import { senhaForteValida } from '../utils.js';
import Message from '../components/Message.jsx';
import { useNavigate, Link } from 'react-router-dom';

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    async function verificarSessao() {
      try {
        await apiJson('/api/admin/sessao');
      } catch (err) {
        navigate('/admin/login');
      }
    }
    verificarSessao();
  }, []);

  async function salvar(evento) {
    evento.preventDefault();
    setErro('');
    setSucesso('');

    if (novaSenha !== confirmarSenha) {
      setErro('A confirmação da nova senha não confere.');
      return;
    }

    if (!senhaForteValida(novaSenha)) {
      setErro('A nova senha deve ter pelo menos 10 caracteres, letra maiúscula, letra minúscula, número e caractere especial.');
      return;
    }

    setSalvando(true);
    try {
      await apiJson('/api/admin/senha', jsonOptions({ senhaAtual, novaSenha }, 'PATCH'));
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
      setSucesso('Senha alterada com sucesso.');
    } catch (err) {
      setErro(err.message || 'Não foi possível alterar a senha.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="pagina-senha">
      <h1 className="sr-only">Alterar senha</h1>
      <form className="cartao" noValidate onSubmit={salvar}>
        <h2>Alterar senha</h2>
        <Message>{erro}</Message>
        <Message type="sucesso">{sucesso}</Message>

        <div className="campo">
          <label htmlFor="senha-atual">Senha atual</label>
          <input type="password" id="senha-atual" value={senhaAtual} autoComplete="current-password" required autoFocus onChange={(e) => setSenhaAtual(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="nova-senha">Nova senha</label>
          <input type="password" id="nova-senha" value={novaSenha} required minLength="10" autoComplete="new-password" onChange={(e) => setNovaSenha(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="confirmar-senha">Confirmar nova senha</label>
          <input type="password" id="confirmar-senha" value={confirmarSenha} required minLength="10" autoComplete="new-password" onChange={(e) => setConfirmarSenha(e.target.value)} />
        </div>

        <button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar senha'}</button>
        <Link className="botao secundario botao-voltar-senha" to="/admin/agenda">Voltar</Link>
      </form>
    </main>
  );
}
