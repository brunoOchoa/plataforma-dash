import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { companyService } from '../services/companyService';

export interface SelectedCompany {
  id: string;
  name: string;
}

interface CompanyContextType {
  selectedCompany: SelectedCompany | null;
  setSelectedCompany: (c: SelectedCompany | null) => void;
  companies: SelectedCompany[];   // lista completa para o selector (vazia para clientes)
  isCustomer: boolean;            // true → empresa fixa, sem troca
  companiesLoading: boolean;
  companiesError: boolean;
  reloadCompanies: () => void;
}

const CompanyContext = createContext<CompanyContextType | null>(null);

const STORAGE_KEY = 'selected_company';

function loadFromStorage(): SelectedCompany | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SelectedCompany;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return null;
}

interface CompanyProviderProps {
  children: ReactNode;
  /** Passado pelo App quando o usuário logado é do tipo 'customer'.
   *  Se presente, a empresa é fixa (não editável) e a lista não é buscada. */
  customerCompany?: SelectedCompany;
}

export function CompanyProvider({ children, customerCompany }: CompanyProviderProps) {
  const isCustomer = !!customerCompany;

  // Para clientes: empresa sempre é a deles, não salva/lê do storage
  const [selectedCompany, _setSelected] = useState<SelectedCompany | null>(
    isCustomer ? customerCompany : loadFromStorage
  );
  const [companies,        setCompanies]        = useState<SelectedCompany[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(!isCustomer);
  const [companiesError,   setCompaniesError]   = useState(false);

  // Atualiza se o customerCompany mudar (ex: refresh da página com novo token)
  useEffect(() => {
    if (isCustomer && customerCompany) {
      _setSelected(customerCompany);
    }
  }, [isCustomer, customerCompany?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCompanies = useCallback(() => {
    if (isCustomer) return;
    setCompaniesLoading(true);
    setCompaniesError(false);
    companyService.list({ size: 100, active: true })
      .then(r => {
        setCompanies(r.content.map(c => ({ id: c.id, name: c.name })));
        setCompaniesError(false);
      })
      .catch(() => setCompaniesError(true))
      .finally(() => setCompaniesLoading(false));
  }, [isCustomer]);

  // Carrega lista de empresas ao montar — somente para usuários sistema
  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const setSelectedCompany = (c: SelectedCompany | null) => {
    if (isCustomer) return; // empresa fixa — não permite troca
    _setSelected(c);
    if (c) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <CompanyContext.Provider value={{
      selectedCompany, setSelectedCompany,
      companies, isCustomer,
      companiesLoading, companiesError,
      reloadCompanies: fetchCompanies,
    }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used inside CompanyProvider');
  return ctx;
}
