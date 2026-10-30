import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, apiError, clearToken, saveToken } from "./api";

const MvpAuthContext = createContext(null);

export const HOME_BY_ROLE = {
  student: "/aluno",
  professional: "/profissional",
  institution: "/instituicao",
  admin: "/admin",
};

export function MvpAuthProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [checking, setChecking] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setAccount(data);
    } catch (e) {
      setAccount(null);
      clearToken();
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const signIn = useCallback(async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    saveToken(data.access_token);
    await refresh();
    return data.user;
  }, [refresh]);

  const signUp = useCallback(async payload => {
    const { data } = await api.post("/auth/register", payload);
    saveToken(data.access_token);
    await refresh();
    return data.user;
  }, [refresh]);

  const signOut = useCallback(async () => {
    try { await api.post("/auth/logout"); } catch (e) { /* sessão local já será limpa */ }
    clearToken();
    setAccount(null);
  }, []);

  const value = useMemo(() => ({
    account, user: account?.user || null, institution: account?.institution || null,
    checking, signIn, signUp, signOut, refresh,
  }), [account, checking, refresh, signIn, signUp, signOut]);

  return <MvpAuthContext.Provider value={value}>{children}</MvpAuthContext.Provider>;
}

export function useMvpAuth() {
  const ctx = useContext(MvpAuthContext);
  if (!ctx) throw new Error("useMvpAuth precisa do MvpAuthProvider");
  return ctx;
}

export function RequireRole({ role, children }) {
  const { user, checking } = useMvpAuth();
  const location = useLocation();
  if (checking) return <div className="mvp-loading" data-testid="mvp-loading">Carregando sua área…</div>;
  if (!user) return <Navigate to={`/entrar?next=${location.pathname}`} replace />;
  if (user.role !== role) return <Navigate to={HOME_BY_ROLE[user.role] || "/"} replace />;
  return children;
}

export { apiError };
