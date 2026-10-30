const W = 1080;
const H = 1350;

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const blob = (ctx, x, y, r, inner, outer) => {
  const g = ctx.createRadialGradient(x - r * .3, y - r * .3, r * .1, x, y, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 1.18, -.2, 0, Math.PI * 2);
  ctx.fill();
};

const wrap = (ctx, text, maxWidth) => {
  const words = String(text).split(" ");
  const lines = [];
  let line = "";
  words.forEach(word => {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = word; }
    else line = next;
  });
  if (line) lines.push(line);
  return lines;
};

export async function renderJourneyCard(rows) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  try { await document.fonts.ready; } catch (e) { /* fontes já disponíveis */ }

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#f7f4fd");
  bg.addColorStop(1, "#eee9fb");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = .5;
  blob(ctx, 950, 1180, 190, "#cbb6f2", "#8871bd");
  blob(ctx, 130, 1250, 140, "#f6efff", "#c5aee7");
  ctx.restore();

  ctx.save();
  roundRect(ctx, 64, 64, W - 128, H - 128, 52);
  ctx.shadowColor = "rgba(76,52,124,.22)";
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 24;
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, 64, 64, W - 128, H - 128, 52);
  ctx.clip();
  const bar = ctx.createLinearGradient(64, 0, W - 64, 0);
  bar.addColorStop(0, "#7254ad");
  bar.addColorStop(1, "#9ad8c2");
  ctx.fillStyle = bar;
  ctx.fillRect(64, 64, W - 128, 8);
  ctx.restore();

  const left = 128;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#4c347c";
  ctx.font = "700 34px 'DM Sans', sans-serif";
  ctx.fillText("acolhe", left, 176);
  const brandWidth = ctx.measureText("acolhe").width;
  ctx.fillStyle = "#a58fd4";
  ctx.font = "500 46px 'DM Sans', sans-serif";
  ctx.fillText("⌁", left + brandWidth + 10, 180);

  ctx.save();
  ctx.font = "700 18px 'DM Sans', sans-serif";
  if ("letterSpacing" in ctx) ctx.letterSpacing = "2px";
  const tag = "RESUMO DEMONSTRATIVO";
  const tagWidth = ctx.measureText(tag).width + 44;
  roundRect(ctx, W - 128 - tagWidth, 146, tagWidth, 44, 22);
  ctx.fillStyle = "#f4f1fa";
  ctx.fill();
  ctx.fillStyle = "#8d819d";
  ctx.fillText(tag, W - 128 - tagWidth + 22, 175);
  ctx.restore();

  ctx.fillStyle = "#332b45";
  ctx.font = "500 92px 'Fraunces', Georgia, serif";
  ctx.fillText("Minha jornada", left, 320);

  ctx.font = "400 26px 'DM Sans', sans-serif";
  ctx.fillStyle = "#766d84";
  ctx.fillText("Um retrato do caminho que você percorreu.", left, 366);

  let y = 452;
  rows.forEach(([label, value]) => {
    ctx.strokeStyle = "#efeaf7";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, y - 42);
    ctx.lineTo(W - left, y - 42);
    ctx.stroke();

    ctx.save();
    ctx.font = "700 19px 'DM Sans', sans-serif";
    if ("letterSpacing" in ctx) ctx.letterSpacing = "2px";
    ctx.fillStyle = "#a094b0";
    ctx.fillText(String(label).toUpperCase(), left, y);
    ctx.restore();

    ctx.font = "500 34px 'DM Sans', sans-serif";
    ctx.fillStyle = "#332b45";
    const lines = wrap(ctx, value, W - left * 2);
    lines.slice(0, 2).forEach((line, i) => ctx.fillText(line, left, y + 48 + i * 42));
    y += 108 + (Math.min(lines.length, 2) - 1) * 42;
  });

  ctx.save();
  roundRect(ctx, left, H - 268, W - left * 2, 96, 28);
  ctx.fillStyle = "#f6f2fd";
  ctx.fill();
  ctx.font = "400 22px 'DM Sans', sans-serif";
  ctx.fillStyle = "#766d84";
  ctx.fillText("Protótipo educacional · sem atendimento real.", left + 34, H - 216);
  ctx.fillText("Este resumo não é um documento clínico.", left + 34, H - 186);
  ctx.restore();

  return canvas;
}

export async function downloadJourneyCard(rows) {
  const canvas = await renderJourneyCard(rows);
  return new Promise(resolve => {
    canvas.toBlob(imageBlob => {
      const url = URL.createObjectURL(imageBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "minha-jornada-acolhe.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      resolve();
    }, "image/png");
  });
}
