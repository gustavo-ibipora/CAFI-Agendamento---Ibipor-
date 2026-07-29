import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import brasao from '../../assets/img/LOGO-PREFEITURA-VETOR---Copia-branca.png';

export default function Header({ subtitle, pathname = window.location.pathname, children }) {
  const rotaAtual = pathname;
  const [menuAberto, setMenuAberto] = useState(false);

  const [isAdmin, setIsAdmin] = useState(null);

  useEffect(() => {
    async function checarSessao() {
      try {
        const res = await fetch('/api/admin/sessao');
        if (res.ok) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        setIsAdmin(false);
      }
    }
    checarSessao();
  }, [pathname]);

  const links = [
    { href: '/', label: 'Início' },
    { href: '/agendamento', label: 'Agendamento' },
    //{ href: '/admin/login', label: 'Acessar'}
  ];

  if (isAdmin) {
    links.push({ href: '/admin/agenda', label: 'Painel Administrativo' });
  }

  return (
    <header className="topo">
      <div className="barra-institucional">
        <div className="barra-conteudo">
          <span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.35 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.94-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            Coordenação CAFI: (43) 3178-8470
          </span>
          <span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            Segunda a sexta | 8h as 15h
          </span>
        </div>
      </div>

      <div className="cabecalho-principal">
        <Link to="/" aria-label="Ir para a página inicial" className="cabecalho-logo">
          <img className="brasao" src={brasao} alt="Prefeitura Municipal de Ibiporã" />
        </Link>

        <div className="titulos">
          <p className="titulo-institucional">Prefeitura Municipal de Ibiporã-PR</p>
          <p>Central de Abastecimento Farmacêutico - {subtitle}</p>
        </div>

        {children && (
          <div className="cabecalho-admin-desktop">
            {children}
          </div>
        )}

        {!children && isAdmin === false && (
          <Link className="atalho-admin" to="/admin/login" aria-label="Acessar painel administrativo">
            Acessar
          </Link>
        )}

        <button
          className="btn-menu-mobile"
          type="button"
          aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuAberto}
          aria-controls="menu-principal"
          onClick={() => setMenuAberto(!menuAberto)}
        >
          {menuAberto ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>

      <nav
        id="menu-principal"
        className={`menu-municipal${menuAberto ? ' menu-aberto' : ''}`}
        aria-label="Navegação principal"
      >
        <div className="menu-conteudo">
          {links.map(({ href, label }) => {
            const ativo = href === '/' ? rotaAtual === '/' : rotaAtual.startsWith(href);
            return (
              <Link
                key={href}
                to={href}
                aria-current={ativo ? 'page' : undefined}
                onClick={() => setMenuAberto(false)}
              >
                {label}
              </Link>
            );
          })}
          {isAdmin === false && (
            <Link
              className="acesso-menu-mobile"
              to="/admin/login"
              aria-label="Acessar painel administrativo"
              onClick={() => setMenuAberto(false)}
            >
              Acessar
            </Link>
          )}
          {children && (
            <div className="menu-admin-mobile">
              {children}
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
