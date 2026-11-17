import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { useParams } from "react-router-dom";
import BrandMark from "../components/BrandMark";
import { api, apiError, formatDate } from "./api";

export default function CertificateValidationPage() {
  const { code } = useParams();
  const [state, setState] = useState({ loading: true, certificate: null, error: "" });
  useEffect(() => {
    let active = true;
    api.get(`/certificates/${encodeURIComponent(code || "")}`).then(({ data }) => {
      if (active) setState({ loading: false, certificate: data.certificate, error: "" });
    }).catch(error => {
      if (active) setState({ loading: false, certificate: null, error: apiError(error) });
    });
    return () => { active = false; };
  }, [code]);
  return <main className="certificate-validation-page"><section className="certificate-validation-card">
    <div className="certificate-validation-brand"><BrandMark size={38} /><strong>Acolhe</strong></div>
    {state.loading ? <p className="certificate-validation-status">Verificando certificado…</p> : state.certificate ? <>
      <div className="certificate-validation-icon valid"><CheckCircle2 size={26} /></div>
      <span className="certificate-validation-kicker">Validação pública</span>
      <h1>Certificado válido</h1>
      <p className="certificate-validation-title">{state.certificate.title}</p>
      <div className="certificate-validation-details"><strong>{state.certificate.professional_name}</strong><span>{state.certificate.institution_name}</span><span>{state.certificate.completed_count} conversas concluídas</span><span>Emitido em {formatDate(state.certificate.issued_at)}</span></div>
      <small className="certificate-validation-code">Código: {state.certificate.code}</small>
    </> : <>
      <div className="certificate-validation-icon invalid"><XCircle size={26} /></div>
      <span className="certificate-validation-kicker">Validação pública</span>
      <h1>Certificado não encontrado</h1>
      <p className="certificate-validation-title">Confira o código e tente novamente.</p>
    </>}
  </section></main>;
}
