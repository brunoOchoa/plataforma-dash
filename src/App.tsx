import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CompanyProvider, type SelectedCompany } from './context/CompanyContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Permissions from './pages/Permissions';
import Companies from './pages/Companies';
import Departments from './pages/Departments';
import KnowledgeBases from './pages/KnowledgeBases';
import Bots from './pages/Bots';
import ComingSoon from './pages/ComingSoon';

function Protected({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

/** Rota exclusiva para usuários sistema — redireciona clientes para /dashboard */
function SystemOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.type === 'customer') return <Navigate to="/dashboard" replace />;
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

/** Ponte entre AuthContext e CompanyProvider.
 *  Lê o usuário logado e, se for cliente, passa a empresa fixa como prop. */
function CompanyBridge({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const customerCompany: SelectedCompany | undefined =
    user?.type === 'customer' && user.company_id && user.company_name
      ? { id: user.company_id, name: user.company_name }
      : undefined;

  return (
    <CompanyProvider customerCompany={customerCompany}>
      {children}
    </CompanyProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
    <ErrorBoundary>
      <AuthProvider>
        <CompanyBridge>
          <BrowserRouter>
            <Routes>
              {/* Pública */}
              <Route path="/login" element={<Login />} />

              {/* Protegidas */}
              <Route path="/dashboard"   element={<Protected><ErrorBoundary><Dashboard /></ErrorBoundary></Protected>} />
              <Route path="/users"       element={<Protected><ErrorBoundary><Users /></ErrorBoundary></Protected>} />
              <Route path="/companies"   element={<SystemOnly><ErrorBoundary><Companies /></ErrorBoundary></SystemOnly>} />
              <Route path="/permissions" element={<SystemOnly><ErrorBoundary><Permissions /></ErrorBoundary></SystemOnly>} />
              <Route path="/departments"     element={<Protected><ErrorBoundary><Departments /></ErrorBoundary></Protected>} />
              <Route path="/knowledge-bases" element={<Protected><ErrorBoundary><KnowledgeBases /></ErrorBoundary></Protected>} />
              <Route path="/bots"        element={<Protected><ErrorBoundary><Bots /></ErrorBoundary></Protected>} />
              <Route path="/settings"    element={<Protected><ErrorBoundary><ComingSoon title="Configurações" description="Configurações gerais do sistema estarão disponíveis em breve." /></ErrorBoundary></Protected>} />

              {/* Fallback — só redireciona para login se não logado */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </CompanyBridge>
      </AuthProvider>
    </ErrorBoundary>
    </ThemeProvider>
  );
}
