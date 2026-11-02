import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const app = await readFile(resolve(root, "src/App.js"), "utf8");
const css = await readFile(resolve(root, "src/mobile.css"), "utf8");
const home = app.slice(app.indexOf("function Home()"), app.indexOf("function InfoPage"));

test("home presents the current MVP rather than a rotating demo", () => {
  assert.match(home, /Acesso ao MVP/);
  assert.match(home, /Fluxo do MVP/);
  assert.match(home, /hero-role-\$\{role\}/);
  assert.doesNotMatch(home, /setInterval\(\(\) => setAutoIndex/);
  assert.doesNotMatch(home, /Experiência demonstrativa/);
});

test("mobile home keeps the product card compact", () => {
  assert.match(css, /max-width: 370px/);
  assert.match(css, /\.mvp-role-options \.demo-option/);
});

test("primary home actions enter the MVP", () => {
  assert.match(home, /data-testid="hero-talk-button"/);
  assert.match(home, /to="\/entrar" className="button primary"/);
});

test("role cards provide context without changing authorization", async () => {
  const login = await readFile(resolve(root, "src/mvp/LoginPage.jsx"), "utf8");
  assert.match(home, /to={`\/entrar\?perfil=\$\{role\}`}/);
  assert.match(login, /PROFILE_CONTEXT/);
  assert.match(login, /HOME_BY_ROLE\[logged\.role\]/);
});

test("role cards use the product icon language", () => {
  assert.match(home, /Building2/);
  assert.match(home, /UserRound/);
  assert.match(home, /GraduationCap/);
  assert.doesNotMatch(home, /["'`]▥["'`]/);
  assert.doesNotMatch(home, /["'`]◯["'`]/);
  assert.doesNotMatch(home, /["'`]⌂["'`]/);
});

test("MVP roles stay behind their protected areas", () => {
  assert.match(app, /path="\/aluno" element={<RequireRole role="student">/);
  assert.match(app, /path="\/profissional" element={<RequireRole role="professional">/);
  assert.match(app, /path="\/instituicao" element={<RequireRole role="institution">/);
  assert.match(app, /path="\/admin" element={<RequireRole role="admin">/);
});

test("legacy beta paths are kept behind the MVP entry point", () => {
  assert.match(app, /location\.pathname === "\/login-demo"/);
  assert.match(app, /location\.pathname === "\/profissional-dashboard"/);
  assert.match(app, /location\.pathname === "\/instituicoes\/painel"/);
  assert.match(app, /location\.pathname === "\/app"/);
  assert.match(app, /location\.pathname\.startsWith\("\/app\/"\)/);
  assert.match(app, /window\.location\.replace\("\/entrar"\)/);
});

test("informational CTAs do not promise the retired beta", () => {
  assert.match(app, /data-testid="info-primary-cta">Entrar no Acolhe/);
  assert.match(app, /data-testid="professional-form-cta">Registrar interesse profissional/);
  assert.match(app, /data-testid="institution-dashboard-link">Entrar como instituição/);
  assert.doesNotMatch(app, /data-testid="info-primary-cta">Ver a experiência demonstrativa/);
});

test("home remains bounded to the five-block information architecture", () => {
  assert.equal((home.match(/<section className="(hero|problem-band|cta-band)/g) || []).length, 3);
  assert.match(home, /<AudienceBand\/>/);
  assert.match(home, /<FaqSection compact\/>/);
});
