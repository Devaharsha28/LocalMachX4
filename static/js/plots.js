/**
 * SVG plotters and formatted tables for MachUpX aerodynamic results.
 */

function fmt(val, digits = 4) {
  if (val === null || val === undefined || Number.isNaN(val)) return "—";
  return Number(val).toFixed(digits);
}

export function renderForcesTable(forces) {
  if (!forces || !forces.total) return "<div>No force results yet.</div>";
  const t = forces.total;
  const rows = [
    ["Lift", "CL", t.CL, "FL", t.FL],
    ["Drag", "CD", t.CD, "FD", t.FD],
    ["Side Force", "CS", t.CS, "FS", t.FS],
    ["Body X", "Cx", t.Cx, "Fx", t.Fx],
    ["Body Y", "Cy", t.Cy, "Fy", t.Fy],
    ["Body Z", "Cz", t.Cz, "Fz", t.Fz],
    ["Roll Moment (body)", "Cl", t.Cl, "Mx", t.Mx],
    ["Pitch Moment (body)", "Cm", t.Cm, "My", t.My],
    ["Yaw Moment (body)", "Cn", t.Cn, "Mz", t.Mz],
    ["Pitch Moment (wind)", "Cm_w", t.Cm_w, "My_w", t.My_w],
  ];

  let html = `<table class="res-table">
    <thead><tr><th>Component</th><th>Coeff</th><th>Value</th><th>Dim</th><th>Value</th></tr></thead><tbody>`;
  for (const [label, ck, cv, dk, dv] of rows) {
    html += `<tr><td>${label}</td><td>${ck}</td><td>${fmt(cv, 6)}</td><td>${dk}</td><td>${fmt(dv, 4)}</td></tr>`;
  }
  html += `</tbody></table>`;
  return html;
}

export function renderDerivativesTable(derivs) {
  if (!derivs) return "<div>No derivative results yet. Run 'Aerodynamic Derivatives' or 'Full Analysis'.</div>";
  let html = "";
  for (const group of ["stability", "damping", "control"]) {
    const obj = derivs[group];
    if (!obj) continue;
    html += `<h4 style="margin:8px 0 4px;text-transform:capitalize;">${group} Derivatives</h4>`;
    html += `<table class="res-table"><thead><tr><th>Derivative</th><th>Value</th><th>Derivative</th><th>Value</th></tr></thead><tbody>`;
    const entries = Object.entries(obj);
    for (let i = 0; i < entries.length; i += 2) {
      const [k1, v1] = entries[i];
      const [k2, v2] = entries[i + 1] || ["", null];
      html += `<tr><td>${k1}</td><td>${fmt(v1, 5)}</td><td>${k2}</td><td>${k2 ? fmt(v2, 5) : ""}</td></tr>`;
    }
    html += `</tbody></table>`;
  }
  return html || "<div>No derivatives available.</div>";
}

function makeLineSvg(title, seriesList, xLabel = "y (span)") {
  const W = 340, H = 190, padL = 46, padR = 14, padT = 14, padB = 28;
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  for (const s of seriesList) {
    for (let i = 0; i < s.x.length; i++) {
      const xv = s.x[i], yv = s.y[i];
      if (xv < xmin) xmin = xv;
      if (xv > xmax) xmax = xv;
      if (yv < ymin) ymin = yv;
      if (yv > ymax) ymax = yv;
    }
  }
  if (!Number.isFinite(xmin)) return `<div class="plot-card"><div class="plot-title">${title}</div><div>No data</div></div>`;
  if (xmax === xmin) { xmax += 1; xmin -= 1; }
  if (ymax === ymin) { ymax += 0.1; ymin -= 0.1; }
  const yPad = (ymax - ymin) * 0.08;
  ymin -= yPad; ymax += yPad;

  const sx = (v) => padL + ((v - xmin) / (xmax - xmin)) * (W - padL - padR);
  const sy = (v) => H - padB - ((v - ymin) / (ymax - ymin)) * (H - padT - padB);

  const colors = ["#0074d9", "#ff4136", "#2ecc40", "#b10dc9", "#ff851b", "#111111"];
  let paths = "";
  let legend = "";
  seriesList.forEach((s, idx) => {
    const col = colors[idx % colors.length];
    const pts = s.x.map((xv, i) => `${sx(xv).toFixed(1)},${sy(s.y[i]).toFixed(1)}`).join(" ");
    paths += `<polyline fill="none" stroke="${col}" stroke-width="1.8" points="${pts}" />`;
    legend += `<span style="color:${col};margin-right:8px;font-size:10px;">■ ${s.name}</span>`;
  });

  const zeroY = ymin <= 0 && ymax >= 0 ? `<line x1="${padL}" y1="${sy(0)}" x2="${W - padR}" y2="${sy(0)}" stroke="#ccc" stroke-dasharray="3,3" />` : "";

  return `
    <div class="plot-card">
      <div class="plot-title">${title}</div>
      <div>${legend}</div>
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">
        <rect x="${padL}" y="${padT}" width="${W - padL - padR}" height="${H - padT - padB}" fill="#fafafa" stroke="#ddd" />
        ${zeroY}
        ${paths}
        <text x="${padL - 4}" y="${padT + 8}" font-size="9" text-anchor="end" fill="#555">${ymax.toFixed(3)}</text>
        <text x="${padL - 4}" y="${H - padB}" font-size="9" text-anchor="end" fill="#555">${ymin.toFixed(3)}</text>
        <text x="${padL}" y="${H - 8}" font-size="9" text-anchor="start" fill="#555">${xmin.toFixed(2)}</text>
        <text x="${W - padR}" y="${H - 8}" font-size="9" text-anchor="end" fill="#555">${xmax.toFixed(2)}</text>
        <text x="${(padL + W - padR) / 2}" y="${H - 6}" font-size="9" text-anchor="middle" fill="#333">${xLabel}</text>
      </svg>
    </div>
  `;
}

export function renderDistributionsPlots(distributions) {
  if (!distributions || Object.keys(distributions).length === 0) {
    return "<div>No spanwise distribution data yet. Run 'Spanwise Distributions' or 'Full Analysis'.</div>";
  }

  const metrics = [
    { key: "section_CL", alt: "CL", title: "Section Lift Coefficient (Cl)" },
    { key: "section_CD_i", alt: "CD_i", title: "Section Induced Drag (CDi)" },
    { key: "circ", alt: "gamma", title: "Circulation (Gamma)" },
    { key: "chord", alt: "c", title: "Chord Distribution" },
  ];

  const cards = metrics.map((m) => {
    const series = [];
    for (const [segName, seg] of Object.entries(distributions)) {
      if (!seg || typeof seg !== "object") continue;
      const xArr = seg.cpy || seg.span_frac;
      const yArr = seg[m.key] || seg[m.alt];
      if (Array.isArray(xArr) && Array.isArray(yArr) && xArr.length === yArr.length) {
        series.push({ name: segName, x: xArr, y: yArr });
      }
    }
    return makeLineSvg(m.title, series, "y (span coordinate)");
  });

  return `<div class="plots-grid">${cards.join("")}</div>`;
}
