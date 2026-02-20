import { Construction } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';

interface Props {
  title: string;
  description?: string;
}

export default function ComingSoon({ title, description }: Props) {
  const navigate = useNavigate();

  return (
    <AppShell>
      <div className="page-inner">
        <div className="coming-soon-box">
          <div className="coming-soon-icon">
            <Construction size={28} color="#60a5fa" />
          </div>
          <h2 className="coming-soon-title">{title}</h2>
          <p className="coming-soon-sub">
            {description ?? 'Esta seção está em desenvolvimento e será disponibilizada em breve.'}
          </p>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/dashboard')}
          >
            ← Voltar ao Dashboard
          </button>
        </div>
      </div>
    </AppShell>
  );
}
