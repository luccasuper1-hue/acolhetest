import { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);
const KEY = "acolhe-auth";

export const DEMO_ACCOUNTS = {
  student: { identifier: "student.demo", password: "student123", label: "Estudante" },
  professional: { identifier: "professional.demo", password: "professional123", label: "Profissional" },
};

const loadUser = () => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Só aceita sessões demonstrativas válidas.
    return parsed && DEMO_ACCOUNTS[parsed.role] ? { role: parsed.role, label: DEMO_ACCOUNTS[parsed.role].label } : null;
  } catch (e) {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser);

  useEffect(() => {
    try {
      if (user) localStorage.setItem(KEY, JSON.stringify(user));
      else localStorage.removeItem(KEY);
    } catch (e) { /* armazenamento indisponível — a sessão segue apenas em memória */ }
  }, [user]);

  const login = (role, identifier, password) => {
    const account = DEMO_ACCOUNTS[role];
    if (!account || identifier.trim() !== account.identifier || password !== account.password) return false;
    setUser({ role, label: account.label });
    return true;
  };
  const logout = () => setUser(null);
  const value = useMemo(() => ({ user, login, logout }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
