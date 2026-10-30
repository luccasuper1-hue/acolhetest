/* ============================================================
   Marca Acolhe — símbolo oficial (dois lobos + ponto de partida).
   Um único componente para a marca aparecer igual em todo lugar:
   header, rodapé, logo flutuante, wordmarks e avatar do app.
   A arte vem de public/brand-mark.png (mesma usada nos favicons).
   ============================================================ */

const SRC = `${import.meta.env.BASE_URL}brand-mark.png`;

export const BrandMark = ({ size = 28, className = "", title }) => (
  <img
    src={SRC}
    width={size}
    height={size}
    alt={title || ""}
    aria-hidden={title ? undefined : "true"}
    draggable="false"
    className={className ? `brand-mark ${className}` : "brand-mark"}
  />
);

export default BrandMark;
