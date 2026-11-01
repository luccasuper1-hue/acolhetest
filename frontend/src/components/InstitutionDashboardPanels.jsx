import {
  Activity, BadgeCheck, BarChart3, Check, Heart, Lock, MessageCircle, Route, ShieldCheck, Users, X,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useTheme } from "../theme";
import { dashDemand, dashKpis, dashOperations, dashUsageSeries, dashWeekSeries } from "../data-institutional";

const ICONS = {
  activity: Activity, badge: BadgeCheck, chart: BarChart3, check: Check,
  heart: Heart, message: MessageCircle, route: Route, users: Users,
};

const palette = dark => ({
  brand: dark ? "#bfa4f2" : "#7254ad",
  brandSoft: dark ? "#8e6fd4" : "#a98fdd",
  mint: dark ? "#7ed6b9" : "#4c967f",
  grid: dark ? "rgba(238,230,255,.12)" : "#e4deea",
  axis: dark ? "#b0a3c2" : "#9b91a4",
});

const ChartTip = ({ active, payload, label, unit }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="dash-tooltip">
      <strong>{label}</strong>
      {payload.map(p => (
        <div key={p.dataKey}>{p.name}: {p.value}{unit || ""}</div>
      ))}
      <div style={{ fontSize: 10, opacity: .6, marginTop: 4 }}>dado fictício</div>
    </div>
  );
};

export const InstitutionDashboardPanels = () => {
  const { resolved } = useTheme();
  const c = palette(resolved === "dark");

  return (
    <>
      <section className="section" data-testid="institution-dashboard-panels">
        <div className="dash-head">
          <div>
            <div className="section-kicker">Visão geral da operação</div>
            <h2 style={{ fontSize: 30, letterSpacing: "-1px", lineHeight: 1.16 }}>
              Indicadores agregados, <em>nunca individuais.</em>
            </h2>
          </div>
          <div className="dash-scope">
            <span>Período: últimos 6 meses</span>
            <span>Escopo: toda a instituição</span>
            <span>Origem: dados fictícios</span>
          </div>
        </div>

        <div className="dash-kpis" data-testid="dash-kpis">
          {dashKpis.map(kpi => {
            const Cmp = ICONS[kpi.icon] || Activity;
            return (
              <article className="inst-card dash-kpi" key={kpi.label} data-testid={`dash-kpi-${kpi.icon}`}>
                <div className="dash-kpi-top">
                  <span className="demo-label">DEMO</span>
                  <Cmp size={17}/>
                </div>
                <strong>{kpi.value}</strong>
                <span className="dash-kpi-label">{kpi.label}</span>
                <span className="dash-kpi-trend">{kpi.trend}</span>
              </article>
            );
          })}
        </div>

        <div className="dash-grid">
          <article className="inst-card dash-card" data-testid="dash-usage-chart">
            <div className="dash-card-head">
              <div>
                <h3>Utilização ao longo do tempo</h3>
                <p>Acessos à plataforma e solicitações de apoio, por mês</p>
              </div>
              <span className="demo-label">FICTÍCIO</span>
            </div>
            <div className="dash-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashUsageSeries} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="acolheAcessos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c.brand} stopOpacity={.34}/>
                      <stop offset="100%" stopColor={c.brand} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="acolheSolic" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c.mint} stopOpacity={.3}/>
                      <stop offset="100%" stopColor={c.mint} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={c.grid} vertical={false}/>
                  <XAxis dataKey="mes" stroke={c.axis} tickLine={false} axisLine={false} fontSize={11}/>
                  <YAxis stroke={c.axis} tickLine={false} axisLine={false} fontSize={11}/>
                  <Tooltip content={<ChartTip/>} cursor={{ stroke: c.grid }}/>
                  <Area type="monotone" dataKey="acessos" name="Acessos" stroke={c.brand} strokeWidth={2.4} fill="url(#acolheAcessos)"/>
                  <Area type="monotone" dataKey="solicitacoes" name="Solicitações" stroke={c.mint} strokeWidth={2.2} fill="url(#acolheSolic)"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="inst-note"><BarChart3 size={14}/>Série demonstrativa criada para ilustrar o painel. Não representa uso real.</p>
          </article>

          <article className="inst-card dash-card" data-testid="dash-demand">
            <div className="dash-card-head">
              <div>
                <h3>Categorias gerais de demanda</h3>
                <p>Agrupamento amplo, sem identificar estudantes</p>
              </div>
              <span className="demo-label">FICTÍCIO</span>
            </div>
            <div className="demand-list">
              {dashDemand.map(d => (
                <div className="demand-row" key={d.label}>
                  <div className="demand-row-top"><span>{d.label}</span><span>{d.value}%</span></div>
                  <div className="demand-bar"><i style={{ width: `${d.value * 2.6}%` }}/></div>
                </div>
              ))}
            </div>
            <p className="inst-note"><Lock size={14}/>Categorias amplas por desenho: nada aqui permite chegar a uma pessoa.</p>
          </article>
        </div>

        <div className="dash-grid">
          <article className="inst-card dash-card" data-testid="dash-week-chart">
            <div className="dash-card-head">
              <div>
                <h3>Conversas por dia da semana</h3>
                <p>Distribuição agregada das conversas realizadas</p>
              </div>
              <span className="demo-label">FICTÍCIO</span>
            </div>
            <div className="dash-chart dash-chart-sm">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashWeekSeries} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke={c.grid} vertical={false}/>
                  <XAxis dataKey="dia" stroke={c.axis} tickLine={false} axisLine={false} fontSize={11}/>
                  <YAxis stroke={c.axis} tickLine={false} axisLine={false} fontSize={11}/>
                  <Tooltip content={<ChartTip/>} cursor={{ fill: c.grid, opacity: .4 }}/>
                  <Bar dataKey="conversas" name="Conversas" fill={c.brand} radius={[8, 8, 4, 4]} maxBarSize={38}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="inst-card dash-card" data-testid="dash-operations">
            <div className="dash-card-head">
              <div>
                <h3>Operação administrativa</h3>
                <p>Filas e contagens — sem conteúdo de conversas</p>
              </div>
              <span className="demo-label">FICTÍCIO</span>
            </div>
            <div className="dash-ops">
              {dashOperations.map(op => (
                <div className="dash-op-row" key={op.title}>
                  <div>
                    <strong>{op.title}</strong>
                    <span style={{ display: "block" }}>{op.detail}</span>
                  </div>
                  <span className={op.tone ? `dash-op-status ${op.tone}` : "dash-op-status"}>{op.status}</span>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="dash-grid" style={{ gridTemplateColumns: "1fr" }}>
          <article className="inst-card dash-card" data-testid="dash-privacy-panel">
            <div className="dash-card-head">
              <div>
                <h3>O que a instituição não vê</h3>
                <p>Limites que fazem parte do desenho do produto</p>
              </div>
              <ShieldCheck size={18}/>
            </div>
            <ul className="dash-privacy">
              {[
                "O conteúdo de qualquer conversa entre estudante e profissional",
                "Quais estudantes específicos usaram a plataforma",
                "O assunto escolhido por uma pessoa identificada",
                "Registros profissionais, anotações ou avaliações",
                "Qualquer informação que permita identificar quem buscou apoio",
              ].map(item => (
                <li key={item}><X size={15}/><span>{item}</span></li>
              ))}
            </ul>
            <p className="inst-note">
              <ShieldCheck size={14}/>
              Somente números agregados fariam sentido em um modelo institucional responsável. A confidencialidade
              profissional é um princípio central e não uma permissão configurável.
            </p>
          </article>
        </div>
      </section>
    </>
  );
};

export default InstitutionDashboardPanels;
