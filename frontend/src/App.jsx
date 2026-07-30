import { useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import HomePage from './pages/HomePage.jsx';
import SchedulingPage from './pages/SchedulingPage.jsx';
import ConfirmationPage from './pages/ConfirmationPage.jsx';
import AdminLoginPage from './pages/AdminLoginPage.jsx';
import AdminAgendaPage from './pages/AdminAgendaPage.jsx';
import ChangePasswordPage from './pages/ChangePasswordPage.jsx';

const TITLES = {
  '/': 'Farmácia Municipal - Agendamento',
  '/agendamento': 'Agendar retirada - Farmácia Municipal',
  '/confirmacao': 'Agendamento confirmado - Farmácia Municipal',
  '/admin/login': 'Painel administrativo - Farmácia Municipal',
  '/admin/agenda': 'Agenda do dia - Farmácia Municipal',
  '/admin/alterar-senha': 'Alterar senha - Farmácia Municipal',
  '/admin/usuarios': 'Gerenciar usuários - Farmácia Municipal',
  '/admin/logs': 'Logs administrativos - Farmácia Municipal',
  '/admin/relatorios': 'Relatorios de agendamentos - Farmácia Municipal'
};

function subtitleFor(pathname) {
  if (pathname.startsWith('/admin/')) return 'Painel administrativo';
  if (pathname === '/agendamento') {
    return 'Agendamento para retirada de medicamentos';
  }
  return 'Agendamento para retirada de medicamentos';
}

export default function App() {
  const location = useLocation();
  const [headerNav, setHeaderNav] = useState(null);

  useEffect(() => {
    document.title = TITLES[location.pathname] || TITLES['/'];
    setHeaderNav(null);
  }, [location.pathname]);

  return (
    <>
      <Header subtitle={subtitleFor(location.pathname)} pathname={location.pathname}>{headerNav}</Header>
      <Routes>
        <Route path="/agendamento" element={<SchedulingPage />} />
        <Route path="/confirmacao" element={<ConfirmationPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/agenda" element={<AdminAgendaPage setHeaderNav={setHeaderNav} />} />
        <Route path="/admin/alterar-senha" element={<ChangePasswordPage />} />
        <Route path="/admin/usuarios" element={<AdminAgendaPage abaInicial="usuarios" setHeaderNav={setHeaderNav} />} />
        <Route path="/admin/logs" element={<AdminAgendaPage abaInicial="logs" setHeaderNav={setHeaderNav} />} />
        <Route path="/admin/relatorios" element={<AdminAgendaPage abaInicial="relatorios" setHeaderNav={setHeaderNav} />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
      {!location.pathname.startsWith('/admin/') && <Footer />}
    </>
  );
}
