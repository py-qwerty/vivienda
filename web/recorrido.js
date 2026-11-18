/* ---------- recorrido: qué mueve el precio de la vivienda ---------- */
const RC = D.recorrido;
const suma = a => a.reduce((x, y) => x + (y || 0), 0);
const ult = a => a[a.length - 1];
const varPct = (a, b) => 100 * (b / a - 1);
const millones = v => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(Math.round(v / 1e4) / 100) + " millones";
const milesR = v => nf0.format(Math.round(v / 1000) * 1000);
const pctE = v => nf0.format(Math.round(v)) + " %";
const signoE = v => (v >= 0 ? "+" : "−") + nf0.format(Math.abs(Math.round(v))) + " %";
const MES_CORTO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const hastaMes = p => `de enero a ${MES_CORTO[+p.slice(5, 7) - 1]} de ${p.slice(0, 4)}`;
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

/* ---- gráficos (se dibujan al ancho real del contenedor y se rehacen al cambiar de tamaño) ---- */
const vivos = new Set();
const ro = new ResizeObserver(es => { for (const e of es) if (e.target._cfg && e.target._w !== Math.round(e.contentRect.width)) dibujar(e.target); });

function grafico(cont, cfg) { cont._cfg = cfg; vivos.add(cont); ro.observe(cont); dibujar(cont); }

function ticksBonitos(min, max, n = 4) {
  const paso0 = (max - min) / n, mag = Math.pow(10, Math.floor(Math.log10(paso0)));
  const paso = [1, 2, 2.5, 5, 10].map(k => k * mag).find(k => k >= paso0);
  const t = [];
  for (let v = Math.ceil(min / paso) * paso; v <= max + 1e-9; v += paso) t.push(+v.toFixed(6));
  return t;
}

function leyendaHTML(items) {
  return `<div class="leyenda">${items.map(it => `<span><i class="${it.tipo || "sq"}" style="background:${it.c}"></i>${it.n}</span>`).join("")}</div>`;
}

function dibujar(cont) {
  const cfg = cont._cfg;
  const W = Math.max(280, Math.round(cont.clientWidth)); cont._w = W;
  const H = cfg.alto || 260, estrecho = W < 520;
  const m = { t: 14, r: cfg.tipo === "lineas" && cfg.finales !== false ? (estrecho ? 46 : 64) : 10, b: 26, l: cfg.ml || 46 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const X = cfg.x, n = X.length;
  const todas = [...(cfg.series || []), ...(cfg.lineas || [])];
  const pila = cfg.tipo === "barras" && cfg.modo === "pila";
  const sumaSigno = (i, pos) => suma(cfg.series.map(s => s.v[i]).filter(v => v != null && (pos ? v > 0 : v < 0)));
  let ymin = cfg.y.min ?? (pila ? Math.min(0, ...X.map((_, i) => sumaSigno(i, false))) : 0), ymax = cfg.y.max;
  if (ymax == null) {
    const vals = pila ? X.map((_, i) => sumaSigno(i, true)) : todas.flatMap(s => s.v);
    ymax = Math.max(...vals.filter(v => v != null), ...(cfg.lineas || []).flatMap(s => s.v).filter(v => v != null));
  }
  const ticks = cfg.y.ticks || ticksBonitos(ymin, ymax);
  if (!cfg.y.ticks && ticks.length > 1 && ticks[0] > ymin + 1e-9) { const st = ticks[1] - ticks[0]; ticks.unshift(+(ticks[0] - st).toFixed(6)); ymin = ticks[0]; }
  if (!cfg.y.ticks && ticks.length > 1) { const st = ticks[1] - ticks[0]; while (ult(ticks) < ymax - 1e-9) ticks.push(+(ult(ticks) + st).toFixed(6)); }
  ymax = Math.max(ymax, ult(ticks));
  const y = v => m.t + (1 - (v - ymin) / (ymax - ymin)) * ph;
  const barras = cfg.tipo === "barras";
  const band = pw / n;
  const x = i => barras ? m.l + band * (i + 0.5) : m.l + (n === 1 ? pw / 2 : (i / (n - 1)) * pw);
  const fy = cfg.y.fmt || (v => nf0.format(v));
  let s = `<svg width="${W}" height="${H}" role="img" aria-label="${esc(cfg.aria || "")}">`;
  s += `<g class="grid">${ticks.map(t => `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}"></line>`).join("")}</g>`;
  for (const bd of (cfg.bandas || [])) {
    const xa = barras ? x(bd.i0) - band / 2 : x(bd.i0), xb = barras ? x(bd.i1) + band / 2 : x(bd.i1);
    s += `<rect class="banda" x="${xa}" y="${m.t}" width="${Math.max(0, xb - xa)}" height="${ph}"></rect>`;
    s += `<text class="bandat" x="${xa + 8}" y="${m.t + 14}">${esc(bd.t)}</text>`;
  }
  for (const mc of (cfg.marcas || [])) {
    const xm = barras ? x(mc.i) - band / 2 : x(mc.i);
    s += `<line class="corte" x1="${xm}" x2="${xm}" y1="${m.t}" y2="${H - m.b}"></line>`;
    s += `<text class="cortet" x="${xm + 4}" y="${m.t + (mc.fila || 1) * 13 + (cfg.bandas ? 14 : 0)}">${esc(mc.t)}</text>`;
  }
  if (cfg.y.ref != null) s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(cfg.y.ref)}" y2="${y(cfg.y.ref)}" class="refl"></line>`;
  s += `<g class="axis">${ticks.map(t => `<text x="${m.l - 8}" y="${y(t) + 3.5}" text-anchor="end">${fy(t)}</text>`).join("")}</g>`;
  // eje X: tantas etiquetas como quepan
  const cabe = Math.max(2, Math.floor(pw / (estrecho ? 46 : 52)));
  const paso = Math.ceil(n / cabe);
  const marcas = [];
  for (let i = n - 1; i >= 0; i -= paso) marcas.push(i);
  s += `<g class="axis">${marcas.map(i => `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${X[i]}</text>`).join("")}</g>`;
  const y0b = ymin < 0 ? 0 : ymin;
  s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(y0b)}" y2="${y(y0b)}" class="base"></line>`;

  if (barras) {
    const k = cfg.series.length, grupo = cfg.modo !== "pila";
    const ancho = Math.min(grupo ? 34 * k : 30, band * (grupo ? 0.62 : 0.7));
    const sub = grupo ? Math.max(1.5, ancho / k - (k > 1 ? 2 : 0)) : ancho;
    X.forEach((_, i) => {
      let pos = Math.max(0, ymin), neg = 0;
      cfg.series.forEach((se, j) => {
        const v = se.v[i]; if (v == null || v === 0) return;
        let x0, y0, y1;
        if (grupo) { x0 = x(i) - ancho / 2 + j * (sub + 2); y0 = y(Math.max(v, y0b)); y1 = y(Math.min(v, y0b)); }
        else if (v > 0) { x0 = x(i) - sub / 2; y0 = y(pos + v); y1 = y(pos); pos += v; }
        else { x0 = x(i) - sub / 2; y0 = y(neg); y1 = y(neg + v); neg += v; }
        const h = Math.max(1, y1 - y0 - (!grupo && Math.abs(y1 - y0) > 3 ? 1.5 : 0));
        s += `<rect x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${sub.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(3, sub / 3)}" style="fill:${se.c}"></rect>`;
        if (cfg.etiquetas && grupo && sub >= 22) s += `<text x="${(x0 + sub / 2).toFixed(1)}" y="${(y0 - 6).toFixed(1)}" text-anchor="middle" class="bl">${cfg.etiquetas(v)}</text>`;
      });
    });
  }
  const lineas = cfg.tipo === "lineas" ? cfg.series : (cfg.lineas || []);
  const finales = [];
  for (const se of lineas) {
    let d = "", abierto = false;
    se.v.forEach((v, i) => { if (v == null) { abierto = false; return; } d += `${abierto ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`; abierto = true; });
    s += `<path class="ln" d="${d}" style="stroke:${se.c}"></path>`;
    const li = se.v.map((v, i) => v == null ? -1 : i).filter(i => i >= 0).pop();
    s += `<circle cx="${x(li)}" cy="${y(se.v[li])}" r="3.5" class="pt" style="fill:${se.c}"></circle>`;
    if (cfg.tipo === "lineas" && cfg.finales !== false) finales.push({ y: y(se.v[li]), t: (cfg.finFmt || fy)(se.v[li]), c: se.c });
  }
  // medias por periodo (líneas escalonadas): cfg.periodos = { cortes: [índice donde empieza cada periodo] }
  const medias = [];
  if (cfg.periodos && cfg.tipo === "lineas") {
    const lim = [0, ...cfg.periodos.cortes.filter(i => i > 0 && i < n), n];
    for (const se of lineas) {
      const seg = [];
      for (let k = 0; k < lim.length - 1; k++) {
        const vals = se.v.slice(lim[k], lim[k + 1]).filter(v => v != null);
        seg.push({ a: lim[k], b: lim[k + 1] - 1, v: vals.length ? vals.reduce((p, q) => p + q, 0) / vals.length : null });
      }
      medias.push({ se, seg });
      const xa = i => i === 0 ? x(0) : (x(i - 1) + x(i)) / 2, xb = i => i === n - 1 ? x(n - 1) : (x(i) + x(i + 1)) / 2;
      let d = "", prev = null;
      for (const g of seg) {
        if (g.v == null) { prev = null; continue; }
        d += `${prev == null ? "M" : "L"}${xa(g.a).toFixed(1)},${y(g.v).toFixed(1)}L${xb(g.b).toFixed(1)},${y(g.v).toFixed(1)}`;
        prev = g.v;
      }
      s += `<path class="esc" d="${d}" style="stroke:${se.c}"></path>`;
      if (cfg.periodos.etq) for (const g of seg) if (g.v != null)
        s += `<text class="esc-t" x="${((xa(g.a) + xb(g.b)) / 2).toFixed(1)}" y="${(y(g.v) - 7).toFixed(1)}" text-anchor="middle" style="fill:${se.c}">${esc(cfg.periodos.etq(g.v))}</text>`;
    }
  }
  // etiquetas finales sin solaparse
  finales.sort((a, b) => a.y - b.y);
  for (let i = 1; i < finales.length; i++) if (finales[i].y - finales[i - 1].y < 14) finales[i].y = finales[i - 1].y + 14;
  s += finales.map(f => `<text x="${W - m.r + 8}" y="${f.y + 4}" class="fin">${f.t}</text>`).join("");
  for (const a of (cfg.notas || [])) {
    const ax = x(a.i), ay = y(a.v);
    const anc = ax > W - 90 ? "end" : ax < m.l + 60 ? "start" : "middle";
    s += `<circle cx="${ax}" cy="${ay}" r="4" class="ring"></circle><text x="${ax}" y="${ay - 10}" text-anchor="${anc}" class="nota">${esc(a.t)}</text>`;
  }
  s += `<line class="cur" y1="${m.t}" y2="${H - m.b}" visibility="hidden"></line>`;
  s += `<rect class="hov" x="${m.l}" y="${m.t}" width="${pw}" height="${ph}" fill="transparent"></rect></svg>`;
  const ley = todas.length > 1 || medias.length ? leyendaHTML([...todas.map(se => ({ n: se.n, c: se.c, tipo: (cfg.tipo === "lineas" || (cfg.lineas || []).includes(se)) ? "ln" : "sq" })),
    ...(medias.length ? [{ n: cfg.periodos.nombre || "Media de cada periodo", c: "transparent", tipo: "esc" }] : [])]) : "";
  cont.innerHTML = ley + `<div class="cwrap">${s}<div class="ctip" hidden></div></div>`;
  const svg = cont.querySelector("svg"), cur = svg.querySelector(".cur"), tip = cont.querySelector(".ctip");
  const mover = e => {
    const r = svg.getBoundingClientRect(), px = e.clientX - r.left;
    const i = barras ? Math.max(0, Math.min(n - 1, Math.floor((px - m.l) / band)))
                     : Math.max(0, Math.min(n - 1, Math.round((px - m.l) / pw * (n - 1))));
    cur.setAttribute("x1", x(i)); cur.setAttribute("x2", x(i)); cur.setAttribute("visibility", "visible");
    const f = cfg.tipFmt || fy;
    tip.innerHTML = `<b>${cfg.tipX ? cfg.tipX(i) : X[i]}</b>` + todas.map(se => se.v[i] == null ? "" :
      `<span><i style="background:${se.c}"></i>${se.n}: <strong>${f(se.v[i])}</strong></span>`).join("") +
      (medias.length ? `<span class="tx">Media del periodo: ${medias.map(({ se, seg }) => { const g = seg.find(g => i >= g.a && i <= g.b); return g && g.v != null ? `<strong style="color:${se.c}">${nf1.format(g.v)}</strong>` : "—"; }).join(" · ")}</span>` : "") +
      (cfg.tipExtra ? cfg.tipExtra(i) : "");
    tip.hidden = false;
    const left = Math.min(W - tip.offsetWidth, Math.max(0, x(i) - tip.offsetWidth / 2));
    tip.style.left = left + "px";
  };
  svg.addEventListener("pointermove", mover);
  svg.addEventListener("pointerdown", mover);
  svg.addEventListener("pointerleave", () => { cur.setAttribute("visibility", "hidden"); tip.hidden = true; });
}

/* ---- barras horizontales en la misma escala (HTML) ---- */
function barrasH(cont, filas, max, cap) {
  cont.innerHTML = `<div class="hb">${filas.map(f => `<div class="hbrow">
      <div class="hblab"><span>${f.etq}</span></div>
      ${f.vals.map(v => `<div class="hbline"><span class="hbtrack"><i style="width:${Math.min(100, v.v / max * 100)}%;background:${v.c}"></i></span><span class="hbval num">${pct(v.v)}</span><span class="hbwho">${v.quien}</span></div>`).join("")}
    </div>`).join("")}
    <div class="scalecap num"><span>0 %</span><span>${nf0.format(max / 2)} %</span><span>${nf0.format(max)} %</span></div>
    ${cap ? `<p class="note">${cap}</p>` : ""}</div>`;
}

/* ---- cuánto se tarda en construir ---- */
function obraHTML(d) {
  const O = d.R.obra, P = O.periodos;
  if (!P || !P.length) return "";
  const fiab = a => a >= 0.95 ? "Alta" : a >= 0.9 ? "Media" : "Baja";
  const p0 = P[0], pn = ult(P);
  return `<section class="lectura" aria-labelledby="obra-t">
    <h3 id="obra-t">Plazos de construcción de una vivienda</h3>
    <div class="lect-grid">
      <article><h4>1. Antes de la obra: suelo y licencia</h4><p>Es la fase en la que pesa la regulación: planeamiento urbanístico, licencia y trámites. <strong>No hay una estadística oficial actualizada</strong> de cuánto dura. La del Ministerio sobre licencias llega, como mucho, a 2019–2020. Las estimaciones del sector hablan de 12 a 24 meses para conseguir una licencia (Consejo General de la Arquitectura Técnica) y de 12 a 14 meses en Madrid (Asprima), frente a un plazo legal de unos 3 meses. Son estimaciones, no estadística oficial, y no hay serie por años.</p></article>
      <article><h4>2. La obra: de empezar a terminar</h4><p>Con los datos del Ministerio de viviendas iniciadas y terminadas se puede estimar cuántos meses pasan, de forma típica, entre que una obra empieza y que termina:</p>
        <div class="tabla"><table class="num obra"><thead><tr><th scope="col">Periodo</th><th scope="col">Tiempo de obra típico</th><th scope="col">Fiabilidad</th></tr></thead>
        <tbody>${P.map(x => `<tr><th scope="row">${x.desde}–${x.hasta}</th><td><strong>~${x.meses} meses</strong></td><td>${fiab(x.ajuste)}</td></tr>`).join("")}</tbody></table></div></article>
      <article><h4>Qué se ve</h4><p>Las obras tardan más que hace una década: de unos ${p0.meses} meses en ${p0.desde}–${p0.hasta} a unos ${pn.meses} en ${pn.desde}–${pn.hasta}. Coincide en el tiempo con la evolución del empleo en el sector, que se ve más abajo. El último periodo tiene una fiabilidad ${fiab(pn.ajuste).toLowerCase()}, así que su cifra es orientativa.</p></article>
    </div>
    <div class="aviso">
      <div class="aviso-cab"><span class="chip-aviso"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 21h20L12 3z"></path><path d="M12 10v5M12 18v.5"></path></svg>Ojo al interpretarlo</span>
        <h3>El tiempo de obra no mide la regulación</h3></div>
      <p>Que una obra tarde más puede deberse a que faltan trabajadores, a retrasos en materiales o a edificios más grandes, no necesariamente a más burocracia. La regulación pesa sobre todo <strong>antes</strong> de empezar, en la fase de suelo y licencia, y para esa fase no hay datos oficiales actualizados. Por eso estos datos no permiten decir si en un año concreto hubo más o menos regulación.</p>
      <p><strong>Cómo se calcula:</strong> se busca el retraso, en meses, con el que la serie de viviendas terminadas mejor sigue a la de viviendas iniciadas, usando medias de 12 meses, en periodos de unos siete años. La fiabilidad indica lo bien que encajan las dos series (alta si el ajuste es muy bueno). No es una medición de obras concretas. Datos hasta ${MES_CORTO[+O.ult_mes.slice(5, 7) - 1]} de ${O.ult_mes.slice(0, 4)}. Fuentes de las estimaciones del sector: <a href="https://observatorioinmobiliario.es/noticias/tecnolog%C3%ADa-y-arquitectura/semanas-frente-a-a%C3%B1os-el-contraste-europeo-en-las-licencias-de-obra/" target="_blank" rel="noopener">Consejo General de la Arquitectura Técnica</a> y <a href="https://www.elespanol.com/invertia/observatorios/vivienda/20260918/espana-cuadruplica-plazo-legal-conceder-licencias-vivienda-espera-encarece-casa-euros/1003744387166_0.html" target="_blank" rel="noopener">datos recogidos por El Español</a>. Estadística oficial de licencias: <a href="https://www.transportes.gob.es/informacion-para-el-ciudadano/informacion-estadistica/construccion/construccion-de-edificios/publicaciones-de-construccion-de-edificios-licencias-municipales-de-obra" target="_blank" rel="noopener">Ministerio, hasta 2019</a>.</p>
    </div></section>`;
}

/* ---- normas nuevas que afectan a la vivienda ---- */
function normasHTML() {
  const N = D.normas;
  if (!N) return "";
  const FASE = { suelo: "Suelo y licencia", obra: "Obra y coste", uso: "Uso y alquiler" };
  const ESTADO = { vigente: "Vigente", pendiente: "Pendiente de aplicar", no_aprobada: "No aprobada", anulada_parte: "Anulada en parte", criterio_judicial: "Criterio de los tribunales" };
  const lista = [...N.normas].sort((a, b) => a.fecha.localeCompare(b.fecha)), nRal = lista.filter(n => n.ralentiza).length;
  const fecha = f => `${MES_CORTO[+f.slice(5, 7) - 1]} ${f.slice(0, 4)}`;
  return `<section class="lectura" aria-labelledby="normas-t">
    <h3 id="normas-t">Normas nuevas que afectan a la vivienda</h3>
    <p class="note">Normas estatales y europeas, y criterios de los tribunales, que han añadido o cambiado exigencias, ordenados por fecha. ${nRal} de ellos tienen casos documentados de planes urbanísticos anulados o paralizados en los tribunales: los marcamos porque son los que más pueden retrasar que haya suelo para construir. Indicamos en qué fase actúan: <strong>suelo y licencia</strong> (antes de empezar la obra), <strong>obra y coste</strong> (cómo hay que construir) o <strong>uso y alquiler</strong> (qué se puede hacer con la vivienda).</p>
    <ol class="normas">${lista.map(n => `<li>
      <span class="nfecha num">${fecha(n.fecha)}</span>
      <div class="ncuerpo">
        <div class="nchips"><span class="nchip">${n.origen}</span><span class="nchip">${FASE[n.fase]}</span><span class="nchip est-${n.estado}">${ESTADO[n.estado]}</span>${n.ralentiza ? '<span class="nchip ral">Ha anulado o paralizado planes</span>' : ""}</div>
        <h4>${n.nombre}</h4>
        <p>${n.cambio}${n.estado_nota ? ` <em>${n.estado_nota}</em>` : ""}</p>
        <a href="${n.fuente}" target="_blank" rel="noopener">Fuente: ${n.fuente_txt}</a>
      </div></li>`).join("")}</ol>
    <div class="aviso">
      <div class="aviso-cab"><span class="chip-aviso"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 21h20L12 3z"></path><path d="M12 10v5M12 18v.5"></path></svg>Qué no dice este listado</span>
        <h3>Recoge qué ha cambiado, no cuánto ha encarecido o retrasado</h3></div>
      <p>No hay datos oficiales que midan cuánto ha añadido cada norma al precio o al plazo de una vivienda, así que no lo estimamos. El listado <strong>no es exhaustivo</strong>: no incluye normas autonómicas ni municipales (planeamiento urbanístico, ordenanzas, plazos de licencia), que son las que más influyen en cuánto se tarda en poder empezar una obra. Revisado el ${new Date(N.revisado).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}.</p>
    </div></section>`;
}

/* ---- inversión y especulación ---- */
function propAlquiler() {
  const P = D.inversion.propiedad, tot = suma(P.grupos.map(g => g.viviendas)), pct = {};
  P.grupos.forEach(g => pct[g.id] = 100 * g.viviendas / tot);
  return { ...P, tot, pct };
}

function parqueHTML() {
  const P = propAlquiler(), N = D.inversion.parque_n, V = D.inversion.vacias_n, B = P.bde;
  const g = id => P.grupos.find(x => x.id === id).viviendas, sp = v => 100 * v / N;
  const alq = P.tot, resto = N - alq - V;
  const mas10 = B.mas10_max_pct / 100 * (P.tot - g("publica"));
  setTimeout(() => { const el = $("c-parque"); if (el) barrasH(el, [
    { etq: "Alquiladas por particulares con una sola vivienda alquilada", vals: [{ v: sp(g("uno")), c: C1, quien: `${milesR(g("uno"))} viviendas` }] },
    { etq: "Alquiladas por particulares con dos o más", vals: [{ v: sp(g("varias")), c: C2, quien: `${milesR(g("varias"))} viviendas` }] },
    { etq: "Alquiladas por empresas privadas (fondos, SOCIMI, promotoras, sociedades…)", vals: [{ v: sp(g("empresas")), c: C3, quien: `${milesR(g("empresas"))} viviendas` }] },
    { etq: "Vivienda pública y social", vals: [{ v: sp(g("publica")), c: C4, quien: `${milesR(g("publica"))} viviendas` }] },
    { etq: "Vacías", vals: [{ v: sp(V), c: "var(--muted)", quien: `${milesR(V)} viviendas` }] },
  ], 20, `Porcentaje sobre el total de ${millones(N)} de viviendas del Censo 2021. Escala de 0 a 20 %. El resto, un ${pct(sp(resto))}, son viviendas en las que vive su propietario, segundas residencias y otros usos.`); });
  return `<section class="lectura" aria-labelledby="parque-t">
    <h3 id="parque-t">Peso sobre el parque total de viviendas</h3>
    <div class="lect-grid">
      <article class="ancho"><p>España tiene <strong>${millones(N)} de viviendas</strong>. Las alquiladas como residencia habitual son unos ${millones(alq)}, el ${pct(sp(alq))}. Las que alquilan las empresas privadas, incluidos los fondos, son el <strong>${pct(sp(g("empresas")))} del parque</strong>.</p>
        <div class="chart" id="c-parque"></div></article>
      <article><h4>Los fondos, dentro de las empresas</h4><p>Ninguna estadística oficial separa a los fondos del resto de empresas. Como referencia, sin carácter oficial: ${P.fondos_no_oficial.map(f => `${f.quien}, ${f.mas_de ? "más de " : ""}${milesR(f.viviendas)} viviendas en alquiler (${pct(sp(f.viviendas))} del parque; <a href="${f.fuente}" target="_blank" rel="noopener">${f.fuente_txt}</a>)`).join("; ")}.</p></article>
      <article><h4>Particulares con más de 10 viviendas</h4><p>Con el máximo del ${B.mas10_max_pct} % del alquiler de mercado que estima la Agencia Tributaria para ${B.mas10_anyo}, serían como mucho unas ${milesR(mas10)} viviendas, el ${pct(sp(mas10))} del parque.</p></article>
      <article><h4>Qué no dice</h4><p>Mezcla años: el parque es del Censo 2021 y el reparto del alquiler, de 2023. Solo cuenta las viviendas que las empresas tienen alquiladas; no hay datos oficiales de las que tienen vacías, en venta o en construcción. El peso nacional puede ser mucho mayor en barrios o ciudades concretos.</p></article>
    </div></section>`;
}

function definicionesHTML() {
  const art = (t, x) => `<article><h4>${t}</h4><p>${x}</p></article>`;
  return `<section class="lectura" aria-labelledby="def-inv">
    <h3 id="def-inv">Definiciones</h3>
    <div class="lect-grid">
      <article class="ancho"><p>Ninguno de estos términos, salvo <strong>gran tenedor</strong>, es una categoría estadística. Los definimos para saber qué mide cada dato y qué no.</p></article>
      ${art("Especulación", "Comprar una vivienda para obtener un beneficio con la subida de su precio y venderla, no para vivir en ella ni alquilarla de forma estable. No hay una estadística oficial que la mida directamente.")}
      ${art("Inversión en alquiler", "Comprar una vivienda para obtener una renta alquilándola. La hacen particulares, sociedades familiares, empresas y fondos.")}
      ${art("«Fondo buitre»", "Término coloquial, sin definición legal, para los fondos que compran activos con problemas con descuento. En España se popularizó entre 2012 y 2016, cuando fondos internacionales compraron carteras de viviendas y créditos de bancos rescatados, y también viviendas públicas.")}
      ${art("SOCIMI", "Sociedad cotizada dedicada a comprar inmuebles para alquilarlos. Tiene un régimen fiscal propio: no paga el Impuesto sobre Sociedades si reparte la mayor parte de sus beneficios como dividendos.")}
      ${art("Gran tenedor", "Figura legal de la Ley 12/2023: quien tiene más de 10 viviendas, o más de 1.500 m² de uso residencial. En zonas de mercado tensionado, las comunidades pueden bajar el umbral a 5 viviendas.")}
      ${art("Persona jurídica", "Cualquier empresa o entidad con personalidad propia: promotoras, bancos, fondos, SOCIMI, sociedades familiares o cooperativas. Es la categoría que usan las estadísticas de compras.")}
      ${art("Compra de inversión", "Compra de una vivienda que no es para vivir en ella: para alquilarla, como segunda residencia o para revenderla. Ninguna estadística oficial la mide directamente; se aproxima con las compras de empresas, de no residentes y sin hipoteca.")}
      ${art("Concentración de la propiedad", "Parte de las viviendas de una zona que tiene un mismo propietario o unos pocos. Es la condición para que un propietario pueda influir en el precio de esa zona: si tiene una parte pequeña, quien busca casa tiene alternativas.")}
      ${art("Zona tensionada", "Zona de mercado residencial tensionado de la Ley 12/2023, que declara cada comunidad. Permite limitar la renta de los nuevos contratos. Exige que el alquiler o la hipoteca supere el 30 % de la renta de los hogares, o que el precio haya subido en cinco años 3 puntos más que el IPC.")}
    </div></section>`;
}

function propiedadHTML() {
  const P = propAlquiler(), E = D.inversion.eri, S = P.serie_particulares;
  setTimeout(() => { const el = $("c-prop-2"); if (el) grafico(el, { tipo: "barras", modo: "pila", alto: 220, x: S.anos,
    series: [{ n: "Con una sola vivienda alquilada", v: S.uno, c: C1 }, { n: "Con dos o más", v: S.varias, c: C2 }],
    y: { fmt: v => v === 0 ? "0" : nf1.format(v / 1e6).replace(/,0$/, "") + " M" }, ml: 48, tipFmt: v => nf0.format(v),
    aria: "Viviendas alquiladas por particulares según cuántas alquilan, 2016 y 2023" }); });
  return `<section class="lectura" aria-labelledby="prop-t">
    <h3 id="prop-t">Cómo se mide la propiedad del alquiler</h3>
    <div class="lect-grid">
      <article class="ancho"><p>No existe una estadística oficial de la propiedad de las viviendas en alquiler. La mejor aproximación disponible combina los datos fiscales de los particulares (Panel de Hogares del IRPF) con una estimación del Banco de España para las empresas. Cubre unas ${millones(P.tot)} de viviendas alquiladas como residencia habitual en ${P.anyo}.</p></article>
      <article class="ancho"><h4>Una o varias viviendas: solo hay dos años</h4><div class="chart" id="c-prop-2"></div><p class="note">El informe publica 2016 y ${P.anyo}, no una serie anual. ${P.serie_particulares.nota}</p></article>
      <article><h4>La serie anual</h4><p>${P.serie_serpavi.nota} <a href="${P.serie_serpavi.fuente}" target="_blank" rel="noopener">Fuente: ${P.serie_serpavi.fuente_txt}</a>.</p></article>
      <article><h4>Por ciudades</h4><p>Porcentaje de las viviendas alquiladas por particulares que pertenecen a quien tiene dos o más: ${P.ciudades_varias.map(([c, v]) => `${c} ${pct(v)}`).join(", ")}.</p></article>
      <article><h4>Compras de empresas</h4><p>Según los Registradores, las personas jurídicas hicieron el ${pct(E.pj_pct)} de las compras de vivienda en ${E.anyo}, frente a un máximo del ${pct(E.pj_max[1])} a comienzos de ${E.pj_max[0]}. Por comunidades, el porcentaje más alto está en ${E.pj_ccaa.map(([c, v]) => `${c} (${pct(v)})`).join(", ")}.</p></article>
    </div>
    <div class="aviso">
      <div class="aviso-cab"><span class="chip-aviso"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 21h20L12 3z"></path><path d="M12 10v5M12 18v.5"></path></svg>Qué no dice este reparto</span>
        <h3>«Dos o más viviendas» no es lo mismo que «gran tenedor»</h3></div>
      <p>El grupo de particulares con dos o más viviendas alquiladas incluye desde quien alquila dos pisos hasta quien alquila decenas: el informe no separa a los que superan las 10 viviendas, que es el umbral legal de gran tenedor. Para ese grupo, la Agencia Tributaria estima que los particulares con más de 10 viviendas tenían <strong>como máximo el ${P.bde.mas10_max_pct} % del alquiler de mercado en ${P.bde.mas10_anyo}</strong> (<a href="${P.bde.fuente}" target="_blank" rel="noopener">${P.bde.fuente_txt}</a>).</p>
      <p><strong>Por qué no hay serie de este reparto:</strong> no se publica cada año. Para las empresas solo hay dos estimaciones hechas con métodos distintos, así que no se pueden comparar entre sí: en torno al ${P.bde.pj_2018_pct} % en 2018, según una encuesta (<a href="${P.bde.fuente_2018}" target="_blank" rel="noopener">${P.bde.fuente_2018_txt}</a>), y en torno al ${P.bde.pj_pct} % en la estimación actual, a partir de datos fiscales.</p>
      <p>${P.nota} No incluye País Vasco ni Navarra, que tienen su propia hacienda. <a href="${P.fuente}" target="_blank" rel="noopener">Fuente: informe del Ministerio de Consumo y el CSIC</a>.</p>
    </div></section>`;
}

function vaciasHTML() {
  const V = D.capas.vacias, pr = V.prov, cods = Object.keys(pr).sort((a, b) => pr[b] - pr[a]);
  const fila = c => ({ etq: nombre(c), vals: [{ v: pr[c], c: C2, quien: "" }] });
  setTimeout(() => { const el = $("c-vac"); if (el) barrasH(el, [{ etq: "España", vals: [{ v: V.nacional, c: C1, quien: "" }] }, ...cods.slice(0, 5).map(fila), ...cods.slice(-3).map(fila)], 50, "Cinco provincias con el porcentaje más alto y tres con el más bajo. Misma escala, de 0 a 50 %."); });
  return `<section class="lectura" aria-labelledby="vac-t">
    <h3 id="vac-t">Viviendas vacías</h3>
    <div class="lect-grid">
      <article class="ancho"><p>En el Censo de 2021 había <strong>${millones(D.inversion.vacias_n)} de viviendas vacías</strong>, el ${pct(V.nacional)} del total. El porcentaje es mayor en provincias del interior con población envejecida y menor en las grandes áreas urbanas. El mapa del paso «Por provincia» las muestra todas.</p>
        <div class="chart" id="c-vac"></div></article>
      <article class="ancho"><p><strong>Qué no dice:</strong> el INE considera vacía una vivienda con un consumo eléctrico muy bajo o nulo durante el año. Ese grupo incluye viviendas en venta o en obras, herencias sin repartir, viviendas en mal estado y también las que su propietario mantiene sin uso. El dato no permite saber cuántas están vacías por cada motivo, ni cuántas están donde hay más demanda.</p></article>
    </div></section>`;
}

function estudiosHTML() {
  const E = D.inversion.eri;
  return `<section class="lectura" aria-labelledby="est-t">
    <h3 id="est-t">Efecto en el precio: qué dicen los estudios</h3>
    <div class="lect-grid">
      <article class="ancho"><p>No hay una estimación oficial de cuánto influyen los grandes propietarios o los fondos en el precio de la vivienda a escala nacional. Los estudios disponibles miden efectos en mercados concretos.</p></article>
      ${D.inversion.estudios.map(e => `<article><h4>${e.titulo}</h4><p>${e.texto} <a href="${e.fuente}" target="_blank" rel="noopener">${e.fuente_txt}</a>.</p></article>`).join("")}
      <article><h4>Compras con recursos propios</h4><p>Los extranjeros hicieron el ${pct(E.ext_compras)} de las compras de vivienda en ${E.anyo}, pero solo el ${pct(E.ext_hipotecas)} de las hipotecas: una parte mayor compra sin financiación. No hay una estadística oficial del total de compras pagadas sin hipoteca.</p></article>
      <article><h4>Escala nacional y escala local</h4><p>Los mismos datos pueden dar lecturas distintas según la escala: un porcentaje pequeño en el conjunto de España puede ser alto en un barrio o una ciudad concretos. Por eso esta sección muestra siempre España y las provincias con los valores más altos.</p></article>
    </div></section>`;
}

/* ---- regulación del precio del alquiler ---- */
// Serie trimestral de contratos nuevos (fianzas del Incasòl, Generalitat de Cataluña)
const RG_VISTAS = {
  "2024": { boton: "Zonas tensionadas (2024)", grupos: [["zt_mar24", "Declarados en marzo de 2024", "var(--s1)"], ["zt_oct24", "Declarados en octubre de 2024", "var(--s2)"], ["cat_no", "Nunca declarados", "var(--s3)"]],
    bandas: [], marcas: [["2020 T2", "Confinamiento", 2], ["2024 T1", "Mar. 2024", 1], ["2024 T4", "Oct. 2024", 2]] },
  "2020": { boton: "Ley 11/2020 (2020–2022)", grupos: [["ley2020", "61 municipios de la Ley 11/2020", "var(--s1)"], ["no2020", "Resto de Cataluña", "var(--s3)"]],
    bandas: [["2020 T4", "2022 T2", "Ley 11/2020 en vigor"]], marcas: [["2024 T1", "Mar. 2024", 1]] },
};
let rgVista = "2024";
// periodos de la regulación en Cataluña: sin límites, Ley 11/2020, sin límites, zonas tensionadas (primer trimestre completo de cada uno)
const RG_CORTES = ["2020 T4", "2022 T2", "2024 T2"];
function rgT() {
  const T = D.regulacion.series.trim, P = T.periodos, i = p => P.indexOf(p);
  const media = v => v.reduce((x, y) => x + y, 0) / v.length;
  const med = (g, a, b, k = "renta") => media(T.grupos[g][k].slice(i(a), i(b) + 1));
  const idx = (g, k) => { const b = med(g, "2019 T1", "2019 T4", k); return T.grupos[g][k].map(v => v == null ? null : Math.round(1000 * v / b) / 10); };
  const cambio = (g, a0, b0, a1, b1, k = "renta") => varPct(med(g, a0, b0, k), med(g, a1, b1, k));
  return { T, P, i, idx, med, cambio, u0: P[P.length - 4], u1: ult(P) };
}
const trimTxt = p => { const [a, q] = p.split(" T"); return `${["primer", "segundo", "tercer", "cuarto"][q - 1]} trimestre de ${a}`; };
// ventanas de cuatro trimestres antes y después de cada medida
const RG_VENT = { mar24: ["2023 T2", "2024 T1"], oct24: ["2023 T4", "2024 T3"], pre20: ["2019 T4", "2020 T3"], dur20: ["2021 T2", "2022 T1"], post20: ["2022 T2", "2023 T1"] };
function rgDatos() {
  const R = rgT(), U = [R.u0, R.u1], c = (g, w, k) => R.cambio(g, ...RG_VENT[w], ...U, k);
  return { R, U,
    mar: { zt: c("zt_mar24", "mar24"), no: c("cat_no", "mar24"), bcn: c("bcn", "mar24"), ztN: c("zt_mar24", "mar24", "contratos"), noN: c("cat_no", "mar24", "contratos"), bcnN: c("bcn", "mar24", "contratos") },
    oct: { zt: c("zt_oct24", "oct24"), no: c("cat_no", "oct24"), ztN: c("zt_oct24", "oct24", "contratos"), noN: c("cat_no", "oct24", "contratos") },
    l20: Object.fromEntries(["ley2020", "no2020", "bcn"].map(g => [g, { dur: R.cambio(g, ...RG_VENT.pre20, ...RG_VENT.dur20), post: R.cambio(g, ...RG_VENT.dur20, ...RG_VENT.post20), n: R.cambio(g, ...RG_VENT.pre20, ...RG_VENT.dur20, "contratos") }])) };
}
function rgDibujar() {
  const R = rgT(), V = RG_VISTAS[rgVista], X = R.P.map(p => p.replace(" T", " T"));
  const T = R.T.grupos, eur = k => k === "renta";
  const vals = V.grupos.flatMap(([g]) => T[g].renta).filter(v => v != null);
  const lo = Math.floor(Math.min(...vals) * 0.95 / 100) * 100, hi = Math.ceil(Math.max(...vals) * 1.03 / 100) * 100;
  const cfg = k => ({ tipo: "lineas", alto: 260, x: X, ml: eur(k) ? 54 : 46,
    series: V.grupos.map(([g, n, c]) => ({ n, v: eur(k) ? T[g].renta.map(v => v == null ? null : Math.round(v)) : R.idx(g, k), c })),
    y: eur(k) ? { min: lo, max: hi, fmt: v => nf0.format(v) + " €" } : { min: 40, max: 140, ref: 100, ticks: [40, 60, 80, 100, 120, 140], fmt: v => nf0.format(v) + " %" },
    finFmt: eur(k) ? v => nf0.format(v) + " €" : v => nf0.format(v) + " %",
    bandas: V.bandas.map(([a, b, t]) => ({ i0: R.i(a) - 0.5, i1: R.i(b) - 0.5, t })),
    marcas: V.marcas.map(([p, t, fila]) => ({ i: R.i(p), t, fila })),
    periodos: { cortes: RG_CORTES.map(R.i), nombre: "Media de cada periodo" },
    tipFmt: eur(k) ? v => `${nf0.format(v)} €/mes` : v => `${nf0.format(v)} % de los de 2019`,
    tipExtra: eur(k) ? null : i => `<span class="tx">${V.grupos.map(([g, n]) => `${n}: ${nf0.format(T[g].contratos[i])} contratos`).join("<br>")}</span>`,
    aria: eur(k) ? "Alquiler medio mensual de los contratos firmados cada trimestre en Cataluña, por grupo de municipios" : "Contratos de alquiler firmados cada trimestre en Cataluña, en porcentaje de la media de 2019" });
  grafico($("c-rg-r"), cfg("renta")); grafico($("c-rg-n"), cfg("contratos"));
  for (const b of $("rg-vistas").children) b.setAttribute("aria-pressed", b.dataset.v === rgVista);
}
function rgDosLeyesHTML() {
  const L20 = "https://www.boe.es/buscar/act.php?id=BOE-A-2020-11363", L23 = "https://www.boe.es/buscar/act.php?id=BOE-A-2023-12203";
  const fila = (t, a, b) => `<tr><th scope="row">${t}</th><td>${a}</td><td>${b}</td></tr>`;
  return `<section class="lectura" aria-labelledby="rg2-t"><h3 id="rg2-t">Dos regulaciones distintas</h3>
    <p class="note">En Cataluña el precio del alquiler se ha limitado dos veces, con leyes distintas. La de 2024 no es una ley nueva: es la ley estatal de vivienda de 2023, que Cataluña empezó a aplicar al declarar sus zonas tensionadas.</p>
    <div class="lect-grid">
      <article><h4>2020–2022: ley catalana 11/2020</h4>
        <p>Ley del Parlament de Cataluña, en vigor del <strong>22 de septiembre de 2020</strong> al <strong>10 de marzo de 2022</strong>, cuando el Tribunal Constitucional la anuló porque fijar la renta de un alquiler es legislación civil, que corresponde al Estado.</p>
        <p>Se aplicaba en <strong>61 municipios</strong> y a <strong>todos los propietarios</strong>. Un contrato nuevo no podía superar el <strong>índice de precios de la Generalitat</strong> para un piso parecido de la zona, ni la renta del contrato anterior: valía el más bajo de los dos. Por eso podía <strong>bajar</strong> alquileres que estaban por encima del índice.</p></article>
      <article><h4>Desde 2024: ley estatal 12/2023</h4>
        <p>Ley de las Cortes Generales de mayo de 2023. Se aplica donde una comunidad declara una zona tensionada: en Cataluña, <strong>140 municipios desde el 16 de marzo de 2024</strong> y <strong>131 más desde el 10 de octubre de 2024</strong>.</p>
        <p>Para los <strong>particulares</strong>, el único tope es la <strong>renta del contrato anterior</strong>: si ya estaba por encima del índice, se puede mantener. Solo los <strong>grandes tenedores</strong> (en Cataluña, 5 viviendas o más en la zona) deben ajustarse al <strong>índice estatal</strong>. Sobre todo <strong>congela</strong> los alquileres en su nivel anterior.</p></article>
    </div>
    <div class="tabla"><table class="rg2"><thead><tr><th scope="col"></th><th scope="col">Ley 11/2020 (catalana)</th><th scope="col">Ley 12/2023 (estatal)</th></tr></thead><tbody>
      ${fila("Vigencia", "Sep. 2020 – mar. 2022 (anulada)", "En Cataluña desde mar. 2024 (vigente)")}
      ${fila("Zonas", "61 municipios, fijados por la propia ley", "Las declara la comunidad: 271 municipios catalanes en 2024")}
      ${fila("Tope para particulares", "Índice de la Generalitat o renta anterior, el más bajo", "Renta del contrato anterior")}
      ${fila("Tope para grandes tenedores", "El mismo que para particulares", "Índice estatal de referencia")}
      ${fila("Índice de precios", "De la Generalitat (fianzas del Incasòl)", "Del Estado (datos de Hacienda)")}
      ${fila("Margen para subir", "±5 % sobre el índice según características del piso, o más si hubo obras de mejora el último año", "Hasta un 10 % más si hubo rehabilitación, mejora energética o de accesibilidad, o si el contrato es de 10 años o más")}
      ${fila("Excepción", "Propietarios con ingresos bajos: solo el tope de la renta anterior", "—")}
      ${fila("Prórroga para el inquilino", "No", "Hasta 3 años más en la zona")}
      ${fila("Incentivos fiscales", "No", "Reducción en el IRPF del propietario, del 50 % al 90 %")}
      ${fila("Sanciones", "Sí, en la ley catalana de vivienda", "No las fija la ley estatal")}
    </tbody></table></div>
    <p class="note">Fuentes: <a href="${L20}" target="_blank" rel="noopener">BOE, Ley 11/2020</a> (art. 1 a 7 y anexo) y <a href="${L23}" target="_blank" rel="noopener">BOE, Ley 12/2023</a> (art. 3 y 18, y cambios en la Ley de Arrendamientos Urbanos y el IRPF). Fuera de Cataluña, la ley estatal se aplica desde 2025 en zonas del País Vasco, Navarra, Galicia y Asturias.</p>
  </section>`;
}
function rgImpactoCabHTML() {
  return `<section class="lectura rg-cab" aria-labelledby="rgi-t"><h3 id="rgi-t">Qué ha pasado con los alquileres</h3>
    <p class="note">A partir de aquí, datos: el alquiler de los contratos que se firman cada trimestre en Cataluña y cuántos se firman, comparando los municipios con límites con los que nunca los han tenido. Elige qué regulación quieres ver.</p></section>`;
}
function rgLeyHTML() {
  const BOE = "https://www.boe.es/buscar/act.php?id=BOE-A-2023-12203", a = (t, h = "") => `<a href="${BOE}${h}" target="_blank" rel="noopener">${t}</a>`;
  return `<details class="rg-det"><summary>Detalle de la ley estatal de zonas tensionadas (Ley 12/2023)</summary><section class="lectura" aria-labelledby="rgl-t"><h3 id="rgl-t">Qué dice la ley de zonas tensionadas</h3>
    <p class="note">Resumen de la Ley 12/2023, de 24 de mayo, por el derecho a la vivienda (artículos 3 y 18) y de los cambios que introduce en la Ley de Arrendamientos Urbanos y en el IRPF (disposiciones finales primera y segunda). Es un resumen descriptivo; el texto que vale es el del ${a("BOE")}.</p>
    <div class="lect-grid">
      <article><h4>Quién declara una zona y durante cuánto tiempo</h4>
        <p>La <strong>comunidad autónoma</strong>, con un procedimiento propio que incluye información pública. Suele empezar a petición del ayuntamiento. El Estado no declara zonas: el Ministerio de Vivienda solo publica cada trimestre la lista de las que han declarado las comunidades.</p>
        <p>La declaración dura <strong>tres años</strong> y se puede prorrogar año a año si siguen las causas, justificando qué se ha hecho para mejorar la situación. Obliga a aprobar un <strong>plan de medidas</strong> con calendario (art. 18).</p></article>
      <article><h4>Cuándo se puede declarar</h4>
        <p>Hace falta una memoria con datos que acredite al menos una de estas dos situaciones (art. 18.3):</p>
        <p><strong>a) Esfuerzo:</strong> la hipoteca o el alquiler medio, más gastos y suministros básicos, supera el <strong>30 %</strong> de los ingresos o la renta media de los hogares.</p>
        <p><strong>b) Subida:</strong> el precio de compra o de alquiler ha subido en los <strong>cinco años</strong> anteriores al menos <strong>3 puntos más que el IPC</strong> de la comunidad.</p>
        <p>El mapa del paso «Inversión y especulación» calcula el criterio b) para cada municipio.</p></article>
      <article><h4>Límite al precio de los contratos nuevos</h4>
        <p>En una zona declarada, la renta de un contrato nuevo <strong>no puede superar la del último contrato</strong> de vivienda habitual que estuvo vigente en esa vivienda en los últimos cinco años, con su actualización anual. Tampoco se pueden añadir gastos que no estaban en el contrato anterior.</p>
        <p>Solo puede subir hasta un <strong>10 % más</strong> si en los dos años anteriores se rehabilitó la vivienda, se mejoró su eficiencia energética (ahorro de al menos el 30 %) o su accesibilidad, o si el contrato es de diez años o más, o da al inquilino derecho a prorrogarlo hasta diez años (Ley de Arrendamientos Urbanos, art. 17.6).</p></article>
      <article><h4>Grandes tenedores y pisos que no estaban alquilados</h4>
        <p>Si el propietario es <strong>gran tenedor</strong>, la renta no puede superar el <strong>índice de referencia de precios</strong> del Ministerio, que depende de las características de la vivienda y del edificio (art. 17.7).</p>
        <p>El mismo límite se aplica a cualquier propietario si la vivienda <strong>no ha estado alquilada en los últimos cinco años</strong>, siempre que la comunidad lo haya justificado en la declaración y lo recoja la resolución del Ministerio.</p>
        <p><strong>Gran tenedor</strong> es quien tiene más de 10 viviendas o más de 1.500 m² de uso residencial, sin contar garajes ni trasteros. En una zona declarada, la comunidad puede bajarlo a <strong>5 o más viviendas</strong> en esa zona si lo justifica (art. 3.k).</p></article>
      <article><h4>Prórroga para el inquilino</h4>
        <p>Cuando termina el contrato y sus prórrogas obligatorias, el inquilino de una zona tensionada puede pedir una <strong>prórroga extraordinaria</strong> por años, <strong>hasta tres</strong>, con las mismas condiciones. El propietario tiene que aceptarla, salvo que acuerden otras condiciones, firmen un contrato nuevo con los límites de renta o el propietario necesite la vivienda para sí o un familiar directo y lo haya avisado en plazo (Ley de Arrendamientos Urbanos, art. 10.3).</p>
        <p>Además, en toda España, el inquilino en situación de vulnerabilidad acreditada por los servicios sociales puede pedir un año más, y el propietario debe aceptarlo si es gran tenedor (art. 10.2).</p></article>
      <article><h4>Incentivos fiscales al propietario</h4>
        <p>El rendimiento del alquiler de vivienda en el IRPF se reduce:</p>
        <p><strong>90 %</strong> si, en una zona tensionada, el nuevo contrato baja la renta más de un 5 % respecto al anterior.<br>
          <strong>70 %</strong> si se alquila por primera vez en zona tensionada a una persona de 18 a 35 años, o a una Administración o entidad sin ánimo de lucro para alquiler social.<br>
          <strong>60 %</strong> si la vivienda se rehabilitó en los dos años anteriores.<br>
          <strong>50 %</strong> en los demás casos.</p>
        <p>No hay reducción si el contrato incumple el límite de renta de la zona. Se aplica a contratos firmados desde la entrada en vigor de la ley.</p></article>
      <article class="ancho"><h4>Qué no regula la ley</h4>
        <p><strong>Contratos de temporada y alquiler de habitaciones:</strong> los límites se refieren a la vivienda habitual, así que estos contratos quedan fuera. Cataluña aprobó en 2025 una ley propia para regularlos, recurrida por el PP. <strong>Contratos ya firmados:</strong> su renta no cambia por la declaración; solo les afecta el límite general a la actualización anual en toda España (2 % en 2023, 3 % en 2024 y, desde 2025, el índice que publica el INE). <strong>Precio de compra:</strong> no se limita. <strong>Sanciones:</strong> la ley estatal no fija un régimen propio para quien supere el límite; depende de las comunidades y de que el inquilino reclame.</p></article>
    </div></section></details>`;
}
function rgPeriodosHTML() {
  const R = rgT(), P = R.P, lim = [P[0], ...RG_CORTES, null];
  const per = lim.slice(0, -1).map((a, k) => [a, lim[k + 1] ? P[R.i(lim[k + 1]) - 1] : ult(P)]);
  const NOM = ["Sin límites", "Ley 11/2020", "Sin límites", "Zonas tensionadas"];
  const filas = [["zt_mar24", "Declarados en marzo de 2024"], ["zt_oct24", "Declarados en octubre de 2024"], ["cat_no", "Nunca declarados"], ["ley2020", "61 municipios de la Ley 11/2020"], ["bcn", "Barcelona"]];
  return `<section class="lectura" aria-labelledby="rgp-t"><h3 id="rgp-t">Media de cada periodo</h3>
    <p class="note">Renta mensual media de los contratos nuevos en cada periodo (las líneas escalonadas del gráfico) y variación frente al periodo anterior. Los periodos tienen distinta duración y la renta sube con el tiempo aunque no cambie nada más, así que lo comparable es la diferencia entre grupos en el mismo periodo.</p>
    <div class="tabla"><table class="num"><thead><tr><th scope="col">Grupo</th>${per.map(([a, b], k) => `<th scope="col">${NOM[k]}<br><span class="muted">${a} – ${b}</span></th>`).join("")}</tr></thead><tbody>
    ${filas.map(([g, n]) => { const m = per.map(([a, b]) => R.med(g, a, b));
      return `<tr><th scope="row">${n}</th>${m.map((v, k) => `<td>${nf0.format(v)} €${k ? `<br><span class="muted">${signoP(varPct(m[k - 1], v))} %</span>` : ""}</td>`).join("")}</tr>`; }).join("")}
    </tbody></table></div></section>`;
}
// precio y cantidad: cambio de la renta y del número de contratos desde el año anterior a los límites
function rgCantidadHTML() {
  const { mar, oct, U } = rgDatos(), R = rgT(), T = R.T.grupos;
  const filas = [["Declarados en marzo de 2024", mar.zt, mar.ztN, "mar24", "zt_mar24"], ["de ellos, Barcelona", mar.bcn, mar.bcnN, "mar24", "bcn"],
    ["Declarados en octubre de 2024", oct.zt, oct.ztN, "oct24", "zt_oct24"], ["Nunca declarados", mar.no, mar.noN, "mar24", "cat_no"]];
  const M = 25, w = v => Math.min(50, Math.abs(v) / M * 50);
  const barra = (v, c) => `<span class="dv-pista"><i style="${v >= 0 ? `left:50%` : `right:50%`};width:${w(v)}%;background:${c}"></i></span><span class="dv-v num">${signoP(v)} %</span>`;
  const n4 = (g, w) => R.med(g, ...RG_VENT[w], "contratos"), n1 = g => R.med(g, ...U, "contratos");
  return `<section class="lectura" aria-labelledby="rgq-t"><h3 id="rgq-t">Precio y número de contratos</h3>
    <p class="note">Desde los límites, la renta de los contratos nuevos ha subido poco en los municipios declarados, pero también se firman menos contratos. Cambio entre los cuatro trimestres anteriores a cada declaración y los cuatro últimos con datos (${U[0]} a ${U[1]}). Misma escala en todas las barras.</p>
    <figure class="panel dv">
      <div class="dv-cab"><span></span><span>${leyendaHTML([{ n: "Renta media de los contratos nuevos", c: C1 }, { n: "Número de contratos nuevos", c: C2 }])}</span></div>
      ${filas.map(([n, r, k, w, g]) => `<div class="dv-fila"><div class="dv-n">${n}<span class="muted">${nf0.format(n4(g, w))} → ${nf0.format(n1(g))} contratos por trimestre</span></div>
        <div class="dv-barras"><div class="dv-b">${barra(r, C1)}</div><div class="dv-b">${barra(k, C2)}</div></div></div>`).join("")}
      <div class="dv-fila dv-eje"><div></div><div class="dv-barras"><div class="dv-ticks num"><span>−${M} %</span><span>0</span><span>+${M} %</span></div></div></div>
    </figure>
    <div class="lect-grid">
      <article><h4>Qué se ve</h4><p>En los declarados en marzo de 2024 la renta sube un ${nf1.format(mar.zt)} % y los contratos caen un ${nf1.format(Math.abs(mar.ztN))} %. En los nunca declarados la renta sube un ${nf1.format(mar.no)} % y los contratos caen menos, un ${nf1.format(Math.abs(mar.noN))} %. Es decir, donde el precio se contiene, también se registran menos contratos.</p></article>
      <article><h4>Por qué pueden caer los contratos</h4><p>Hay varias explicaciones posibles, y los datos no permiten separarlas: <strong>menos oferta</strong> (pisos que se venden o dejan de alquilarse), <strong>menos rotación</strong> (los inquilinos se mudan menos porque su contrato tiene una renta más baja que la del mercado, o piden la prórroga extraordinaria) o <strong>contratos fuera de la regulación</strong>, como los de temporada o de habitaciones, que la ley estatal no limita (Cataluña los regula con una ley propia desde finales de 2025).</p></article>
      <article><h4>Qué no dice</h4><p>La caída había empezado antes: entre 2019 y el año anterior a los límites, los contratos ya bajaron un ${nf0.format(Math.abs(R.cambio("zt_mar24", "2019 T1", "2019 T4", ...RG_VENT.mar24, "contratos")))} % en los municipios declarados en marzo y un ${nf0.format(Math.abs(R.cambio("cat_no", "2019 T1", "2019 T4", ...RG_VENT.mar24, "contratos")))} % en los nunca declarados. Esta serie no separa los contratos de temporada, así que no muestra si han sustituido a los de larga duración. Para eso harían falta los datos del Incasòl por tipo de contrato, que la Generalitat no publica en abierto por municipio.</p></article>
    </div></section>`;
}
function rgAntesHTML() {
  const { mar, oct, l20, U } = rgDatos(), T = D.regulacion.series.trim.grupos;
  const f = v => `${signoP(v)} %`, ventana = w => `${RG_VENT[w][0]} a ${RG_VENT[w][1]}`;
  return `<section class="lectura" aria-labelledby="rga-t"><h3 id="rga-t">Antes y después de cada medida, contratos nuevos</h3>
    <p class="note">Media de cuatro trimestres antes de cada medida frente a los cuatro últimos con datos (${U[0]} a ${U[1]}), para evitar el efecto de la estación del año. Renta mensual media de los contratos nuevos registrados en el Incasòl.</p>
    <div class="tabla"><table class="num"><thead><tr><th scope="col">Zonas tensionadas (Ley 12/2023)</th><th scope="col">Antes</th><th scope="col">Renta</th><th scope="col">Contratos</th></tr></thead><tbody>
      <tr><th scope="row">Declarados en marzo de 2024 (${T.zt_mar24.municipios} municipios)</th><td>${ventana("mar24")}</td><td>${f(mar.zt)}</td><td>${f(mar.ztN)}</td></tr>
      <tr><th scope="row">&nbsp;&nbsp;de ellos, Barcelona</th><td>${ventana("mar24")}</td><td>${f(mar.bcn)}</td><td>${f(mar.bcnN)}</td></tr>
      <tr><th scope="row">Nunca declarados (${T.cat_no.municipios} municipios)</th><td>${ventana("mar24")}</td><td>${f(mar.no)}</td><td>${f(mar.noN)}</td></tr>
      <tr><th scope="row">Declarados en octubre de 2024 (${T.zt_oct24.municipios} municipios)</th><td>${ventana("oct24")}</td><td>${f(oct.zt)}</td><td>${f(oct.ztN)}</td></tr>
      <tr><th scope="row">Nunca declarados</th><td>${ventana("oct24")}</td><td>${f(oct.no)}</td><td>${f(oct.noN)}</td></tr>
    </tbody></table></div>
    <div class="tabla"><table class="num"><thead><tr><th scope="col">Ley 11/2020 (sep. 2020 – mar. 2022)</th><th scope="col">Renta: antes → último año en vigor</th><th scope="col">Renta: último año en vigor → año siguiente</th><th scope="col">Contratos: antes → último año en vigor</th></tr></thead><tbody>
      ${[["ley2020", `61 municipios de la ley`], ["bcn", "&nbsp;&nbsp;de ellos, Barcelona"], ["no2020", "Resto de Cataluña"]].map(([g, n]) => `<tr><th scope="row">${n}</th><td>${f(l20[g].dur)}</td><td>${f(l20[g].post)}</td><td>${f(l20[g].n)}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="note">Ley 11/2020: antes = ${ventana("pre20")}; último año en vigor = ${ventana("dur20")}; año siguiente = ${ventana("post20")}. El periodo coincide con la pandemia, que bajó los alquileres en las ciudades grandes por su cuenta.</p></section>`;
}

/* mapa de municipios regulados y ficha de cada uno */
const RM = { sel: "08019" };
const RM_CAT = [["2020", "Ley 11/2020 y zona tensionada desde 2024", "var(--r7)"], ["2020s", "Solo Ley 11/2020 (2020–2022)", "var(--r2)"], ["2024", "Zona tensionada desde 2024", "var(--r5)"], ["2025", "Desde 2025", "var(--r4)"], ["2026", "Desde 2026", "var(--r3)"]];
function rmCat(v) {
  if (!v) return null;
  if (v.ley2020) return v.zt ? "2020" : "2020s";
  return v.zt ? v.zt[0].slice(0, 4) : null;
}
const fechaLarga = f => new Date(f).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
function rmMedidas(v) {
  const l = [];
  if (v.ley2020) l.push("Ley 11/2020: topes de septiembre de 2020 a marzo de 2022");
  if (v.zt) l.push(`Zona tensionada${v.zt[1] ? " (parte del municipio)" : ""} desde el ${fechaLarga(v.zt[0])}`);
  return l;
}
function rmTip(c, e) {
  const v = MM.datos.reg.mun[c], tip = $("rm-tip"), nom = (MM.datos.m[c] || {}).n || c;
  if (!v) { tip.hidden = true; return; }
  tip.innerHTML = `<strong>${esc(nom)}</strong>${rmMedidas(v).map(x => `<span class="c">${x}</span>`).join("")}<span class="c">Pulsa para ver su serie</span>`;
  tip.hidden = false;
  const box = $("rm-box").getBoundingClientRect(), x = e.clientX - box.left, y = e.clientY - box.top;
  tip.style.left = Math.max(0, Math.min(box.width - tip.offsetWidth, x + 14)) + "px";
  tip.style.top = Math.max(0, y - tip.offsetHeight - 12) + "px";
}
function rmFicha() {
  const Rg = MM.datos.reg, v = Rg.mun[RM.sel], nom = (MM.datos.m[RM.sel] || {}).n || RM.sel, el = $("c-rm");
  $("rm-sel").setAttribute("d", MM.caminos.mun[RM.sel] || "");
  $("rm-lista").value = RM.sel;
  $("rm-ft").textContent = nom;
  $("rm-med").innerHTML = rmMedidas(v).map(x => `<span class="nchip">${x}</span>`).join("");
  $("rm-quien").innerHTML = rmHitos(RM.sel, v).map(h => `<p class="rm-q"><strong>${h.nombre}.</strong> ${h.quien.filter(q => q.rol !== "Aplica").map(q => `${q.rol}: ${q.texto}`).join(" ")}</p>`).join("");
  const P = Rg.periodos;
  if (v.r && v.r.filter(x => x != null).length >= 8) {
    const n = P.length, cortes = [], bandas = [];
    if (v.ley2020) { const a0 = P.indexOf("2020 T4"), a1 = P.indexOf("2022 T2"); cortes.push(a0, a1); bandas.push({ i0: a0 - 0.5, i1: a1 - 0.5, t: "Ley 11/2020" }); }
    if (v.zt) { const a = +v.zt[0].slice(0, 4), m = +v.zt[0].slice(5, 7), iz = P.indexOf(`${a} T${Math.ceil(m / 3)}`) + 1;
      if (iz > 0 && iz < n) { cortes.push(iz); bandas.push({ i0: iz - 0.5, i1: n - 1, t: "Zona tensionada" }); } }
    const vals = v.r.filter(x => x != null), lo = Math.floor(Math.min(...vals) * 0.9 / 100) * 100, hi = Math.ceil(Math.max(...vals) * 1.08 / 100) * 100;
    $("rm-sub").innerHTML = `Alquiler medio mensual de los contratos <strong>firmados cada trimestre</strong> en ${esc(nom)}, en euros. ${cortes.length ? "La línea discontinua es la media de cada periodo; las franjas, los periodos con límites al alquiler." : ""}`;
    grafico(el, { tipo: "lineas", alto: 250, x: P,
      series: [{ n: `${nom}, €/mes`, v: v.r, c: C1 }],
      y: { min: lo, max: hi, fmt: x => nf0.format(x) + " €" }, finales: false, ml: 54,
      bandas, periodos: cortes.length ? { cortes, nombre: "Media de cada periodo", etq: x => nf0.format(x) + " €" } : null,
      tipFmt: x => nf0.format(x) + " €/mes", tipExtra: i => v.h[i] ? `<span class="tx">${nf0.format(v.h[i])} contratos nuevos</span>` : "",
      aria: `Alquiler medio mensual de los contratos nuevos en ${nom}, por trimestre` });
    // resumen por periodos, con los municipios nunca declarados como referencia
    const lim = [0, ...cortes.filter(i => i > 0 && i < n).sort((x, y) => x - y), n];
    const NOMP = i => { const a = P[lim[i]]; if (v.ley2020 && a === "2020 T4") return "Ley 11/2020"; if (bandas.some(b => b.t === "Zona tensionada" && Math.round(b.i0 + 0.5) === lim[i])) return "Zona tensionada"; return "Sin límites"; };
    const med = (arr, i) => { const x = arr.slice(lim[i], lim[i + 1]).filter(z => z != null); return x.length ? x.reduce((p, q) => p + q, 0) / x.length : null; };
    const pm = lim.slice(0, -1).map((_, i) => med(v.r, i)), pc = lim.slice(0, -1).map((_, i) => med(Rg.cat_no, i));
    const vp = (arr, i) => i && arr[i] != null && arr[i - 1] != null ? `${signoP(varPct(arr[i - 1], arr[i]))} %` : "—";
    const res = pm.length > 1 ? `<div class="tabla"><table class="num rmt"><thead><tr><th scope="col">Periodo</th><th scope="col">Media en ${esc(nom)}</th><th scope="col">Cambio</th><th scope="col">Cambio en los nunca declarados</th></tr></thead><tbody>
      ${pm.map((x, i) => `<tr><th scope="row">${NOMP(i)}<br><span class="muted">${P[lim[i]]} – ${P[lim[i + 1] - 1]}</span></th><td>${x == null ? "—" : nf0.format(x) + " €"}</td><td>${vp(pm, i)}</td><td>${vp(pc, i)}</td></tr>`).join("")}</tbody></table></div>` : "";
    const u = v.r.length - 1, h0 = v.h.slice(0, 4).reduce((a, b) => a + b, 0), h1 = v.h.slice(-4).reduce((a, b) => a + b, 0);
    $("rm-nota").innerHTML = res + `<p class="note">Contratos nuevos en los cuatro últimos trimestres: ${nf0.format(h1)}, frente a ${nf0.format(h0)} en 2019 (${signoE(varPct(h0, h1))}). La media no corrige por tamaño ni tipo de vivienda. Fuente: Generalitat de Cataluña, fianzas de alquiler depositadas en el Incasòl. Solo trimestres con al menos ${Rg.min_contratos} contratos.</p>`;
  } else if (v.s && v.s.filter(x => x != null).length >= 3) {
    const A = Rg.anos, i0 = A.findIndex((_, k) => v.s[k] != null), ix = arr => arr.map(x => x == null ? null : Math.round(1000 * x / arr[i0]) / 10);
    $("rm-sub").textContent = `Alquiler mediano por m² de los contratos vigentes, ${A[i0]} = 100`;
    grafico(el, { tipo: "lineas", alto: 240, x: A.slice(i0),
      series: [{ n: nom, v: ix(v.s).slice(i0), c: C1 }, { n: "España", v: ix(Rg.espana_m2).slice(i0), c: C3 }],
      y: { ref: 100, fmt: v => nf0.format(v) }, tipFmt: x => nf1.format(x), aria: `Alquiler por metro cuadrado en ${nom} frente a España` });
    $("rm-nota").textContent = `Ministerio de Vivienda, SERPAVI. La serie llega a ${ult(A)} y la regulación empezó después${v.zt ? ` (${fechaLarga(v.zt[0])})` : ""}: muestra cómo venía el alquiler, no el efecto de la medida. Fuera de Cataluña no hay todavía una serie oficial de contratos nuevos por municipio que cubra el periodo regulado.`;
  } else {
    el.innerHTML = ""; $("rm-sub").textContent = "";
    $("rm-nota").textContent = `No hay serie oficial suficiente para este municipio: ${["01", "20", "48", "31"].includes(RM.sel.slice(0, 2)) ? "el País Vasco y Navarra entran tarde en SERPAVI (Álava y Bizkaia, en 2024) y" : "SERPAVI no tiene datos con suficientes alquileres y,"} fuera de Cataluña, no hay una serie oficial de contratos nuevos por municipio que cubra el periodo regulado.`;
  }
}
async function rmIniciar() {
  if (!$("rm-box")) return;
  try {
    if (!MM.datos) { const r = await fetch("municipios.json"); MM.datos = await r.json(); }
    if (!$("rm-box") || !MM.datos.reg) return;
    const G = MM.datos.geo; MM.caminos = MM.caminos || mmCaminos(G);
    const Rg = MM.datos.reg.mun, svg = $("rm-svg");
    svg.setAttribute("viewBox", `0 0 ${G.w} ${G.h}`);
    $("rm-m").innerHTML = Object.entries(MM.caminos.mun).map(([c, d]) => { const k = rmCat(Rg[c]), col = k ? RM_CAT.find(x => x[0] === k)[2] : "var(--surface)";
      return `<path d="${d}" data-c="${c}" style="fill:${col};stroke:${k ? col : "none"}"${k ? ' class="rm-r"' : ""}></path>`; }).join("");
    $("rm-p").setAttribute("d", MM.caminos.prov);
    const [x0, y0, x1, y1] = G.marco; $("rm-marco").setAttribute("d", `M${x0},${y0}H${x1}V${y1}H${x0}Z`);
    $("rm-carga").hidden = true;
    const nombre = c => (MM.datos.m[c] || {}).n || c;
    $("rm-lista").innerHTML = Object.keys(Rg).sort((a, b) => nombre(a).localeCompare(nombre(b), "es")).map(c => `<option value="${c}">${esc(nombre(c))}</option>`).join("");
    $("rm-lista").addEventListener("change", e => { RM.sel = e.target.value; rmFicha(); });
    svg.addEventListener("pointermove", e => { const c = e.target.dataset && e.target.dataset.c; if (c && Rg[c]) { rmTip(c, e); $("rm-hl").setAttribute("d", MM.caminos.mun[c]); } else { $("rm-tip").hidden = true; $("rm-hl").setAttribute("d", ""); } });
    svg.addEventListener("pointerleave", () => { $("rm-tip").hidden = true; $("rm-hl").setAttribute("d", ""); });
    svg.addEventListener("click", e => { const c = e.target.dataset && e.target.dataset.c; if (c && Rg[c]) { RM.sel = c; rmFicha(); } });
    rmFicha();
  } catch (err) {
    $("rm-carga").textContent = "No se ha podido cargar el mapa de municipios.";
  }
}
function rmMapaHTML() {
  const Z = D.mun.decl.por_ccaa;
  setTimeout(rmIniciar);
  return `<section class="lectura" aria-labelledby="rm-t"><h3 id="rm-t">Dónde se ha limitado el precio del alquiler y desde cuándo</h3>
    <p class="note">Municipios donde ha habido o hay límites al precio de los contratos de alquiler: los 61 de la Ley catalana 11/2020 y las zonas tensionadas declaradas con la Ley 12/2023 (${Object.entries(Z).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}, ${n}`).join("; ")}). Pulsa un municipio para ver su serie.</p>
    <div class="mm-pareja">
    <figure class="panel mm-card">
      <h4 id="rm-tit">Municipios con límites al alquiler, por fecha de la primera medida</h4>
      <div class="mapbox" id="rm-box">
        <p class="note" id="rm-carga">Cargando el mapa de municipios…</p>
        <svg class="map mm" id="rm-svg" viewBox="0 0 800 600" role="img" aria-labelledby="rm-tit">
          <g id="rm-m"></g><path id="rm-p" class="mm-prov"></path><path id="rm-marco" class="mm-marco"></path><path id="rm-hl" class="mm-hl"></path><path id="rm-sel" class="mm-hl rm-sel"></path>
        </svg>
        <div class="tip" id="rm-tip" hidden></div>
      </div>
      ${leyendaHTML([...RM_CAT.map(([, n, c]) => ({ n, c })), { n: "Sin límites", c: "var(--surface)" }])}
      <figcaption>Zonas declaradas según el Ministerio de Vivienda (consulta del ${fechaLarga(D.mun.decl.consulta)}). La nueva declaración catalana de octubre de 2026 aún no figura en esa lista. En el País Vasco, Navarra, Galicia y Asturias las zonas se declararon municipio a municipio entre 2025 y 2026.</figcaption>
    </figure>
    <div class="panel mm-card">
      <label class="rm-elige">Municipio <select id="rm-lista"><option>Barcelona</option></select></label>
      <h4 id="rm-ft">Barcelona</h4><div class="nchips" id="rm-med"></div><div id="rm-quien"></div>
      <p class="rm-sub" id="rm-sub"></p>
      <div class="chart" id="c-rm"></div>
      <div class="note" id="rm-nota"></div>
    </div></div></section>`;
}
const quienHTML = n => n.quien ? `<dl class="quien">${n.quien.map(q => `<dt>${q.rol}</dt><dd>${q.texto}</dd>`).join("")}</dl>` : "";
// hitos que afectan a un municipio, para la ficha del mapa
function rmHitos(c, v) {
  const H = D.regulacion.hitos, pr = c.slice(0, 2), out = [];
  if (v.ley2020) out.push(H.find(h => h.fecha === "2020-09"));
  if (v.zt) {
    const lugar = { "08": "Cataluña", "17": "Cataluña", "25": "Cataluña", "43": "Cataluña", "01": "País Vasco", "20": "País Vasco", "48": "País Vasco", "31": "Navarra", "15": "Galicia", "33": "Asturias" }[pr];
    out.push(lugar === "Cataluña" ? H.find(h => h.fecha === "2024-03") : H.find(h => h.lugar === lugar));
  }
  return out.filter(Boolean);
}
function rgHitosHTML() {
  const ESTADO = { vigente: "Vigente", anulada: "Anulada" };
  const fecha = f => `${MES_CORTO[+f.slice(5, 7) - 1]} ${f.slice(0, 4)}`;
  return `<section class="lectura" aria-labelledby="rgh-t"><h3 id="rgh-t">Cronología de las normas y quién las aplicó</h3>
    <p class="note">En España el precio del alquiler solo se ha limitado en Cataluña (2020–2022 y desde 2024) y, desde 2025, en zonas del País Vasco, Navarra, Galicia y Asturias. En cada norma se indica qué institución la aprobó o declaró, qué gobierno había entonces y con qué partidos, quién la pidió y quién la recurrió, cuando consta. Las normas de otros países se muestran más abajo como referencia.</p>
    <ol class="normas">${D.regulacion.hitos.map(n => `<li>
      <span class="nfecha num">${fecha(n.fecha)}</span>
      <div class="ncuerpo">
        <div class="nchips"><span class="nchip est-${n.estado === "anulada" ? "derogada" : "vigente"}">${ESTADO[n.estado]}</span><span class="nchip">${n.lugar}</span></div>
        <h4>${n.nombre}</h4>
        <p>${n.cambio}${n.estado_nota ? ` <em>${n.estado_nota}</em>` : ""}</p>
        ${quienHTML(n)}
        <p class="nfuentes"><a href="${n.fuente}" target="_blank" rel="noopener">Fuente: ${n.fuente_txt}</a>${n.quien_fuente ? ` · <a href="${n.quien_fuente}" target="_blank" rel="noopener">Responsables: ${n.quien_fuente_txt}</a>` : ""}${n.quien_fuente2 ? ` · <a href="${n.quien_fuente2}" target="_blank" rel="noopener">La Moncloa</a>` : ""}</p>
      </div></li>`).join("")}</ol></section>`;
}
function rgCasosHTML() {
  return `<section class="lectura" aria-labelledby="rgc-t"><h3 id="rgc-t">Casos estudiados</h3>
    <div class="lect-grid">${D.regulacion.casos.map(c => `<article><h4>${c.lugar}</h4>
      <p><strong>Qué se reguló:</strong> ${c.regulacion}</p><p><strong>Qué datos hay:</strong> ${c.datos}</p>
      <p><a href="${c.fuente}" target="_blank" rel="noopener">${c.fuente_txt}</a>${c.fuente2 ? ` · <a href="${c.fuente2}" target="_blank" rel="noopener">${c.fuente2_txt}</a>` : ""}</p></article>`).join("")}</div></section>`;
}
function rgEstudiosHTML() {
  return `<section class="lectura" aria-labelledby="rge-t"><h3 id="rge-t">Qué dicen los estudios</h3>
    <div class="lect-grid">${D.regulacion.estudios.map(e => `<article><h4>${e.titulo}</h4><p>${e.texto} <a href="${e.fuente}" target="_blank" rel="noopener">${e.fuente_txt}</a>. <em>Sin carácter oficial.</em></p></article>`).join("")}
      <article class="ancho"><h4>Qué permiten concluir los datos y qué no</h4>
        <p><strong>Permiten ver</strong> que, desde 2024, la renta de los contratos nuevos casi no ha cambiado en los municipios catalanes declarados zona tensionada, mientras que en los nunca declarados ha seguido subiendo a un ritmo parecido al de antes. También que se registran menos contratos nuevos, más en los municipios declarados que en el resto, aunque la caída había empezado en 2021. Con la Ley 11/2020 (2020–2022) la renta bajó en los municipios regulados, pero en plena pandemia, y volvió a subir con fuerza tras la anulación.</p>
        <p><strong>No permiten concluir</strong> cuánto de esas diferencias se debe a la regulación: los municipios declarados se eligieron por tener precios altos y subidas mayores, la renta media no corrige por tipo de vivienda, los contratos de temporada pueden sustituir a los de larga duración y no se sabe qué habría pasado sin la regulación. Tampoco si los contratos que faltan son viviendas que salen del alquiler, inquilinos que se mudan menos o contratos fuera del registro.</p>
        <p><strong>Cambiaría la lectura</strong> con una comparación entre municipios parecidos a ambos lados del límite (por ejemplo, los que quedaron justo por debajo de los criterios), con datos de oferta (viviendas anunciadas, vendidas o pasadas a temporada) y, fuera de Cataluña, con series oficiales de contratos nuevos por municipio que cubran el periodo regulado.</p></article>
    </div></section>`;
}

/* ---- compras de inversión (nacional) ---- */
const AVISO_ICO = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 21h20L12 3z"></path><path d="M12 10v5M12 18v.5"></path></svg>`;
const avisoHTML = (chip, tit, cuerpo) => `<div class="aviso"><div class="aviso-cab"><span class="chip-aviso">${AVISO_ICO}${chip}</span><h3>${tit}</h3></div>${cuerpo}</div>`;
const signoP = v => (v >= 0 ? "+" : "−") + nf1.format(Math.abs(v));

function invCompras() {
  const C = D.inversion.compras, i = a => C.anos.indexOf(a), U = ult(C.anos);
  const maxDe = k => { let j = 0; C[k].forEach((v, n) => { if (v != null && v > C[k][j]) j = n; }); return { a: C.anos[j], v: C[k][j] }; };
  const h = C.hipotecas_100.map((v, n) => [C.anos[n], v]).filter(x => x[1] != null);
  return { C, i, U, maxDe, h, hMin: Math.min(...h.map(x => x[1])), hMax: Math.max(...h.map(x => x[1])) };
}

function comprasHTML() {
  const { C, i, U, maxDe, h, hMin, hMax } = invCompras(), eM = maxDe("empresas"), nM = maxDe("no_residentes");
  setTimeout(() => { const el = $("c-hip100"); if (el) grafico(el, { tipo: "barras", alto: 200, x: h.map(x => x[0]),
    series: [{ n: "Hipotecas por cada 100 compraventas", v: h.map(x => x[1]), c: C4 }], y: { min: 0, max: 100, ticks: [0, 25, 50, 75, 100] },
    tipFmt: v => `${nf0.format(v)} hipotecas por cada 100 compraventas`, aria: "Hipotecas sobre vivienda por cada 100 compraventas, por año" }); });
  return `<section class="lectura" aria-labelledby="compras-t">
    <h3 id="compras-t">Compras de inversión, año a año</h3>
    <div class="lect-grid">
      <article class="ancho"><p>Ninguna estadística oficial pregunta para qué se compra una vivienda. Hay tres datos que se acercan a las compras que no son para vivir en ellas: las que hacen las <strong>empresas</strong>, las que hacen los <strong>extranjeros no residentes</strong> (sobre todo segunda residencia o inversión) y las que se pagan <strong>sin hipoteca</strong>. El gráfico principal muestra las dos primeras junto al precio.</p></article>
      <article><h4>Empresas</h4><p>Hicieron el <strong>${pct(C.empresas[i(U)])}</strong> de las compras en ${U}. El máximo fue el ${pct(eM.v)} en ${eM.a}, cuando el precio estaba cerca de su punto más bajo. En ${U} el precio estaba un ${pctE(varPct(C.precio[i(eM.a)], C.precio[i(U)]))} por encima del de ${eM.a}.</p></article>
      <article><h4>Extranjeros no residentes</h4><p>Hicieron el <strong>${pct(C.no_residentes[i(U)])}</strong> de las compras en ${U}, frente a un máximo del ${pct(nM.v)} en ${nM.a}. Su peso es mucho mayor en Baleares, Canarias y la costa mediterránea: el mapa del paso «Por provincia» lo muestra.</p></article>
      <article><h4>Compras sin hipoteca</h4><p>No hay una estadística oficial de compras pagadas sin préstamo. Comparando hipotecas inscritas y compraventas, desde ${h[0][0]} ha habido entre <strong>${hMin} y ${hMax} hipotecas por cada 100 compraventas</strong>, sin una tendencia clara. Si las compras al contado hubieran crecido mucho, esta cifra habría bajado.</p>
        <div class="chart" id="c-hip100"></div></article>
    </div>
    ${avisoHTML("Qué no dice", "Ninguno de estos datos es «especulación»",
      `<p>Una empresa puede comprar para alquilar, para revender o para su propio uso. Un no residente puede comprar una segunda residencia que usa unas semanas al año. Una compra sin hipoteca puede ser de alguien que vende otra vivienda o que hereda. Son límites superiores de las compras de inversión, no la cifra de especulación. La comparación de hipotecas y compraventas usa dos estadísticas distintas (INE y Ministerio de Vivienda): antes de ${h[0][0]} había más hipotecas que compraventas, porque se hipotecaban también promociones enteras y refinanciaciones, así que esos años no se muestran.</p>`)}
  </section>`;
}

/* año base del gráfico de precio de compra frente a alquiler: se puede cambiar para quitar la crisis */
const PA_BASES = [2015, 2019, 2021];
let paBase = 2015;
function paSerie(base) {
  const PA = D.inversion.precio_alquiler, i0 = PA.anos.indexOf(base);
  const re = arr => arr.slice(i0).map(v => Math.round(1000 * v / arr[i0]) / 10);
  return { anos: PA.anos.slice(i0), compra: re(PA.compra), alquiler: re(PA.alquiler) };
}
function paTexto(base) {
  const S = paSerie(base), U = ult(S.anos), sc = ult(S.compra) - 100, sa = ult(S.alquiler) - 100;
  const PA = D.inversion.precio_alquiler, rel = (c, a) => c / a, i15 = PA.anos.indexOf(base);
  const r0 = Math.round(100 * rel(PA.compra[0], PA.alquiler[0]) / rel(PA.compra[i15], PA.alquiler[i15]));
  return `Quien compra para alquilar espera una renta; quien compra para revender espera que suba el precio. Cuando las compras se apoyan sobre todo en la subida esperada, el precio de compra tiende a subir más que el alquiler. Entre ${base} y ${U}, el precio de compra subió un <strong>${pctE(sc)}</strong> y el alquiler vigente, un <strong>${pctE(sa)}</strong>. La relación entre los dos pasó de 100 a ${nf0.format(Math.round(100 * (100 + sc) / (100 + sa)))}${r0 > 100 && PA.anos[0] < base ? `; en ${PA.anos[0]}, en plena caída de precios, estaba en ${nf0.format(r0)}` : ""}. `;
}


function precioAlquilerHTML() {
  return `<section class="lectura" aria-labelledby="pa-t">
    <h3 id="pa-t">Precio de compra frente a precio del alquiler</h3>
    <div class="lect-grid">
      <article class="ancho"><p id="pa-txt">${paTexto(paBase)}</p></article>
      <article class="ancho"><p><strong>Qué no dice:</strong> el índice de alquiler del INE mide todos los contratos vigentes, no solo los nuevos, y por eso sube más despacio que los alquileres que se firman cada año. Parte de la diferencia viene de ahí. También influyen los tipos de interés: entre 2015 y 2021 el crédito estuvo muy barato (paso «Crédito»), lo que encarece la compra sin que cambie el alquiler. El dato es compatible con compras que esperan revalorización, pero no permite separar ese efecto de los otros dos.</p></article>
    </div></section>`;
}

/* ---- mapa municipal: tensión del alquiler y concentración de la propiedad ---- */
const MM = { datos: null, capa: "cb", caminos: null };
const MCAPAS = [
  { id: "cb", boton: "Años con tensión", titulo: "Años en los que el alquiler subió más de 3 puntos por encima del IPC en cinco años",
    val: v => v.cb, max: () => D.mun.ult - 2015, fmt: v => `${v} de ${D.mun.ult - 2015} años`, cero: true,
    nota: () => `Criterio b) de la Ley 12/2023 para declarar una zona tensionada, comprobado en cada año de 2016 a ${D.mun.ult} con el alquiler mediano por m² de los pisos (SERPAVI). Rayado: menos de ${D.mun.min_alq} viviendas alquiladas en alguno de los años comparados.` },
  { id: "exc", boton: `Subida ${D.mun.ult - 5}–${D.mun.ult}`, titulo: `Subida del alquiler frente al IPC, ${D.mun.ult - 5}–${D.mun.ult}`, div: 20,
    val: v => v.exc, fmt: v => `${signoP(v)} puntos`,
    nota: () => `Puntos de diferencia entre la subida del alquiler mediano por m² de los pisos y la del IPC entre ${D.mun.ult - 5} y ${D.mun.ult}. A partir de +3 se cumple el criterio b) de la Ley 12/2023.` },
  { id: "esf", boton: "Alquiler y renta", titulo: `Alquiler anual sobre la renta media de los hogares, ${D.mun.ult}`, max: () => 30,
    val: v => v.esf, fmt: v => pct(v),
    nota: () => `12 veces el alquiler mediano de un piso, dividido entre la renta neta media de todos los hogares del municipio (INE). Se queda corto frente al criterio a) de la ley (30 %), que incluye gastos y suministros y se refiere a los hogares que alquilan, que suelen tener menos renta.` },
  { id: "zt", boton: "Zonas declaradas", titulo: "Zonas de mercado residencial tensionado declaradas",
    cat: [["entera", "Municipio declarado", "var(--r6)"], ["parcial", "Parte del municipio", "var(--r3)"]],
    val: v => v.zt ? (v.zt[1] ? "parcial" : "entera") : null,
    nota: () => `Declaraciones publicadas por el Ministerio de Vivienda hasta el ${new Date(D.mun.decl.consulta).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}. Las declara cada comunidad si lo pide: que un municipio no esté declarado no significa que no cumpla los criterios.` },
  { id: "mas10", boton: "Más de 10 viviendas", titulo: `Viviendas de propietarios con más de 10 en el mismo municipio, ${D.mun.catastro_anyo}`, max: () => 10,
    val: v => v.mas10, fmt: v => pct(v),
    nota: () => `Porcentaje de los inmuebles residenciales del municipio cuyo titular (persona o empresa) tiene más de 10 en ese municipio (Catastro). Sin País Vasco ni Navarra, que tienen catastro propio.` },
  { id: "pj", boton: "Empresas", titulo: `Viviendas cuyo titular es una empresa, ${D.mun.catastro_anyo}`, max: () => 20,
    val: v => v.pj, fmt: v => pct(v),
    nota: () => `Porcentaje de los inmuebles residenciales del municipio cuyo titular es una persona jurídica privada: promotoras, bancos, fondos, SOCIMI, sociedades familiares… (Catastro). Sin País Vasco ni Navarra.` },
  { id: "vut", boton: "Pisos turísticos", titulo: `Pisos turísticos sobre el total de viviendas, ${D.mun.vut_periodo.replace("-", "/")}`, max: () => 10,
    val: v => v.vut, fmt: v => pct(v),
    nota: () => `Viviendas anunciadas en plataformas de alquiler turístico sobre el total de viviendas (INE, estadística experimental).` },
];

function mmCaminos(geo) {
  const A = geo.arcos.map(d => { const out = []; let x = 0, y = 0; for (let k = 0; k < d.length; k += 2) { x += d[k]; y += d[k + 1]; out.push([x / geo.q, y / geo.q]); } return out; });
  const anillo = r => { const pts = []; for (const idx of r) { const a = idx >= 0 ? A[idx] : A[~idx].slice().reverse(); a.forEach((p, k) => { if (k || !pts.length) pts.push(p); }); } return "M" + pts.map(p => p.join(",")).join("L") + "Z"; };
  const camino = polys => polys.map(p => p.map(anillo).join("")).join("");
  return { mun: Object.fromEntries(Object.entries(geo.mun).map(([c, p]) => [c, camino(p)])), prov: Object.values(geo.prov).map(camino).join("") };
}

function mmColor(capa, v) {
  if (v == null) return null;
  if (capa.cat) return capa.cat.find(x => x[0] === v)[2];
  if (capa.div) return colorDiv(Math.max(-1, Math.min(1, v / capa.div)));
  if (capa.cero && v === 0) return "var(--surface)";
  return colorDe(v / capa.max(), rampa());
}

function mmLeyenda(capa) {
  if (capa.cat) return leyendaHTML([...capa.cat.map(([, n, c]) => ({ n, c })), { n: "No declarado", c: "var(--surface)" }]);
  const cs = getComputedStyle(document.documentElement), g = k => cs.getPropertyValue(k).trim();
  const grad = capa.div ? `linear-gradient(90deg, ${g("--dn")}, ${g("--dm")}, ${g("--dp")})` : `linear-gradient(90deg, ${rampa().join(",")})`;
  const marcas = capa.div ? [-20, -10, 0, 3, 10, 20].map(v => [(v + 20) / 40, (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v) + (v === 20 ? " p." : "")])
    : (capa.id === "cb" ? [0, 3, 6, 9] : [0, capa.max() / 2, capa.max()]).map(v => [v / capa.max(), nf0.format(v) + (capa.id === "cb" ? (v === capa.max() ? " años" : "") : v === capa.max() ? " %" : "")]);
  return `<div class="mm-esc"><div class="mm-grad" style="background:${grad}"></div><div class="mm-ticks num">${marcas.map(([p, t]) => `<span style="left:${p * 100}%">${t}</span>`).join("")}</div></div>
    <div class="leyenda"><span><i style="background:url(#rayas);background:repeating-linear-gradient(45deg,var(--surface) 0 3px,var(--line-strong) 3px 5px)"></i>Sin datos suficientes</span>${capa.cero ? `<span><i style="background:var(--surface);border:1px solid var(--line-strong)"></i>Ningún año</span>` : ""}</div>`;
}

function mmPintar() {
  const capa = MCAPAS.find(c => c.id === MM.capa), M = MM.datos.m;
  for (const p of $("mm-m").children) {
    const v = M[p.dataset.c] ? capa.val(M[p.dataset.c]) : null;
    const sinDato = v == null && !(capa.cat) && !(capa.cero && M[p.dataset.c] && M[p.dataset.c].exc != null);
    const col = capa.cero && v == null && M[p.dataset.c] && M[p.dataset.c].exc != null ? "var(--surface)" : mmColor(capa, v);
    p.style.fill = col || (capa.cat ? "var(--surface)" : "url(#mm-rayas)");
    p.style.stroke = col && !sinDato ? col : "none";
  }
  $("mm-tit").textContent = capa.titulo;
  $("mm-leg").innerHTML = mmLeyenda(capa);
  $("mm-nota").textContent = capa.nota();
  for (const b of $("mm-capas").children) b.setAttribute("aria-pressed", b.dataset.capa === MM.capa);
}

function mmTip(c, e) {
  const v = MM.datos.m[c], tip = $("mm-tip");
  if (!v) { tip.hidden = true; return; }
  const capa = MCAPAS.find(x => x.id === MM.capa), val = capa.val(v);
  const l = [];
  if (v.zt) l.push(`Zona tensionada declarada${v.zt[1] ? " en parte" : ""} desde ${new Date(v.zt[0]).toLocaleDateString("es-ES", { month: "long", year: "numeric" })}`);
  if (v.exc != null) l.push(`Alquiler ${D.mun.ult - 5}–${D.mun.ult}: ${signoP(v.exc)} puntos frente al IPC`);
  if (v.cb != null || v.exc != null) l.push(`Años con subida > IPC + 3: ${(v.cb || []).length} de ${D.mun.ult - 2015}`);
  if (v.alq) l.push(`Alquiler mediano de un piso: ${nf0.format(v.alq)} €/mes (${nf0.format(v.alq_n)} viviendas alquiladas)`);
  if (v.esf != null) l.push(`Alquiler anual / renta media del hogar: ${pct(v.esf)}`);
  if (v.mas10 != null) l.push(`Propietarios con más de 10: ${pct(v.mas10)} · Empresas: ${pct(v.pj)}`);
  if (v.vut != null) l.push(`Pisos turísticos: ${pct(v.vut)}`);
  const vtxt = capa.cat ? (val ? capa.cat.find(x => x[0] === val)[1] : "No declarado") : val == null ? (capa.cero && v.exc != null ? "Ningún año" : "Sin datos suficientes") : capa.fmt(Array.isArray(val) ? val.length : val);
  tip.innerHTML = `<strong>${esc(v.n || c)}</strong><span class="v num">${vtxt}</span>${l.map(x => `<span class="c">${x}</span>`).join("")}`;
  tip.hidden = false;
  const box = $("mm-box").getBoundingClientRect();
  const x = e ? e.clientX - box.left : box.width / 2, y = e ? e.clientY - box.top : box.height / 2;
  tip.style.left = Math.max(0, Math.min(box.width - tip.offsetWidth, x + 14)) + "px";
  tip.style.top = Math.max(0, y - tip.offsetHeight - 12) + "px";
}

async function mmIniciar() {
  const box = $("mm-box");
  if (!box) return;
  try {
    if (!MM.datos) { const r = await fetch("municipios.json"); MM.datos = await r.json(); MM.datos.m = Object.fromEntries(Object.entries(MM.datos.m).map(([c, v]) => [c, v.cb ? { ...v, cb: v.cb } : v])); }
    if (!$("mm-box")) return;
    const G = MM.datos.geo; MM.caminos = MM.caminos || mmCaminos(G);
    // cb se guarda como lista de años; la capa usa cuántos son
    MCAPAS[0].val = v => v.cb ? v.cb.length : null;
    $("mm-svg").setAttribute("viewBox", `0 0 ${G.w} ${G.h}`);
    $("mm-m").innerHTML = Object.entries(MM.caminos.mun).map(([c, d]) => `<path d="${d}" data-c="${c}"></path>`).join("");
    $("mm-p").setAttribute("d", MM.caminos.prov);
    const [x0, y0, x1, y1] = G.marco;
    $("mm-marco").setAttribute("d", `M${x0},${y0}H${x1}V${y1}H${x0}Z`);
    $("mm-carga").hidden = true;
    const svg = $("mm-svg");
    svg.addEventListener("pointermove", e => { const c = e.target.dataset && e.target.dataset.c; if (c) { mmTip(c, e); $("mm-hl").setAttribute("d", MM.caminos.mun[c]); } else { $("mm-tip").hidden = true; $("mm-hl").setAttribute("d", ""); } });
    svg.addEventListener("pointerleave", () => { $("mm-tip").hidden = true; $("mm-hl").setAttribute("d", ""); });
    mmPintar();
  } catch (err) {
    $("mm-carga").textContent = "No se ha podido cargar el mapa de municipios.";
  }
}

function mapaMunHTML() {
  const U = D.mun, Ev = U.evaluables, Cu = U.cumplen, anos = Object.keys(Ev).map(Number);
  const pico = anos.reduce((a, b) => Cu[b] / Ev[b] > Cu[a] / Ev[a] ? b : a);
  const filas = U.top_alq;
  const nacVut = D.capas.turisticas.nacional;
  setTimeout(() => {
    mmIniciar();
    const el = $("c-cumplen"); if (el) grafico(el, { tipo: "barras", alto: 200, x: anos,
      series: [{ n: "Municipios que cumplen el criterio", v: anos.map(a => Math.round(1000 * Cu[a] / Ev[a]) / 10), c: C2 }],
      y: { min: 0, max: 100, ticks: [0, 25, 50, 75, 100], fmt: v => v + " %" }, tipFmt: v => `${nf1.format(v)} %`,
      tipExtra: i => `<span class="tx">${nf0.format(Cu[anos[i]] ?? 0)} de ${nf0.format(Ev[anos[i]] ?? 0)} municipios con datos</span>`,
      aria: "Porcentaje de municipios con datos que cumplen el criterio de subida del alquiler, por año" });
    const cs = $("mm-capas"); if (cs) cs.addEventListener("click", e => { const b = e.target.closest("button"); if (b) { MM.capa = b.dataset.capa; if (MM.datos) mmPintar(); } });
  });
  return `<section class="lectura" aria-labelledby="mm-t">
    <h3 id="mm-t">Dónde se cumplen los criterios de tensión, municipio a municipio</h3>
    <div class="lect-grid">
      <article class="ancho"><p>La Ley 12/2023 permite declarar una <strong>zona de mercado residencial tensionado</strong> cuando se cumple uno de dos criterios: que el alquiler o la hipoteca, más los gastos, supere el 30 % de la renta de los hogares (criterio a), o que el precio haya subido en cinco años al menos <strong>3 puntos más que el IPC</strong> (criterio b). Los calculamos con datos oficiales para todos los municipios con suficientes alquileres, año a año, y los ponemos junto a la concentración de la propiedad y los pisos turísticos. Así se ve dónde hay tensión ahora, dónde la hubo y si coincide con donde hay más grandes propietarios.</p></article>
    </div>
    <div class="seg" role="group" aria-label="Dato que muestra el mapa de municipios" id="mm-capas">${MCAPAS.map(c => `<button type="button" data-capa="${c.id}" aria-pressed="${c.id === MM.capa}">${c.boton}</button>`).join("")}</div>
    <figure class="panel mm-card">
      <h4 id="mm-tit"></h4>
      <div class="mapbox" id="mm-box">
        <p class="note" id="mm-carga">Cargando el mapa de municipios…</p>
        <svg class="map mm" id="mm-svg" viewBox="0 0 800 600" role="img" aria-labelledby="mm-tit">
          <defs><pattern id="mm-rayas" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="var(--surface)"></rect><line x1="0" y1="0" x2="0" y2="4" stroke="var(--line-strong)" stroke-width="1.2"></line></pattern></defs>
          <g id="mm-m"></g><path id="mm-p" class="mm-prov"></path><path id="mm-marco" class="mm-marco"></path><path id="mm-hl" class="mm-hl"></path>
        </svg>
        <div class="tip" id="mm-tip" hidden></div>
      </div>
      <div id="mm-leg"></div>
      <figcaption id="mm-nota"></figcaption>
    </figure>
    <div class="lect-grid">
      <article><h4>Ahora y antes</h4><p>En ${U.ult}, <strong>${nf0.format(Cu[U.ult])} de los ${nf0.format(Ev[U.ult])} municipios</strong> con datos suficientes cumplían el criterio b), el ${pct(100 * Cu[U.ult] / Ev[U.ult])}. El porcentaje más alto fue en ${pico} (${pct(100 * Cu[pico] / Ev[pico])}). En ${anos[0]} solo lo cumplía el ${pct(100 * Cu[anos[0]] / Ev[anos[0]])}: la tensión empezó a extenderse a partir de ${anos.find(a => Cu[a] / Ev[a] > 0.25)}.</p>
        <div class="chart" id="c-cumplen"></div></article>
      <article><h4>Zonas declaradas</h4><p>Hay <strong>${nf0.format(U.decl.n)} municipios</strong> con zonas tensionadas declaradas, en ${Object.keys(U.decl.por_ccaa).length} comunidades: ${Object.entries(U.decl.por_ccaa).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} (${n})`).join(", ")}. De los ${U.decl.evaluables} que se pueden calcular, ${U.decl.cumplen_b} cumplían el criterio b) en ${U.ult} con nuestros datos. Muchos municipios que lo cumplen no están declarados, porque la declaración depende de que la comunidad la pida. <a href="${U.decl.fuente}" target="_blank" rel="noopener">Fuente: Ministerio de Vivienda</a>.</p></article>
      <article><h4>Criterio a): alquiler y renta</h4><p>Con datos oficiales solo se puede aproximar. En los municipios con más de 10.000 viviendas alquiladas, el alquiler anual de un piso mediano va del ${pct(U.esf_rango.min[1])} de la renta media de los hogares en ${esc(U.esf_rango.min[0])} al ${pct(U.esf_rango.max[1])} en ${esc(U.esf_rango.max[0])}. Ninguno llega al 30 % con esta aproximación, que se queda corta: no incluye gastos ni suministros y usa la renta de todos los hogares, no solo de los que alquilan. Por eso el mapa lo muestra como dato continuo y no como criterio cumplido o no.</p></article>
    </div>
    <h4>Municipios con más de 10.000 viviendas alquiladas</h4>
    <div class="tabla"><table class="num mmt"><thead><tr><th scope="col">Municipio</th><th scope="col">Alquiler frente al IPC<br>${U.ult - 5}–${U.ult}</th><th scope="col">Años con tensión<br>(de ${U.ult - 2015})</th><th scope="col">Alquiler / renta</th><th scope="col">Propietarios<br>con más de 10</th><th scope="col">Empresas</th><th scope="col">Pisos<br>turísticos</th><th scope="col">Zona<br>declarada</th></tr></thead>
    <tbody><tr class="dest"><th scope="row">España</th><td>—</td><td>—</td><td>—</td><td>${pct(U.nac_cat.mas10)}</td><td>${pct(U.nac_cat.pj)}</td><td>${pct(nacVut)}</td><td>—</td></tr>
    ${filas.map(f => `<tr><th scope="row">${esc(f.n)}</th><td>${signoP(f.exc)}</td><td>${f.cb}</td><td>${pct(f.esf)}</td><td>${pct(f.mas10)}</td><td>${pct(f.pj)}</td><td>${pct(f.vut)}</td><td>${f.zt ? "Sí" : ""}</td></tr>`).join("")}</tbody></table></div>
    <p class="note">España: media de todos los municipios con datos del Catastro (sin País Vasco ni Navarra) y total nacional de pisos turísticos. Ordenados por la subida del alquiler frente al IPC.</p>
    ${avisoHTML("Qué no dice", "Los criterios no miden la causa de la tensión",
      `<p>Que un municipio cumpla el criterio b) dice que el alquiler subió más que el resto de precios, no por qué. El alquiler de SERPAVI procede de las declaraciones del IRPF: cubre los contratos vigentes declarados, no solo los nuevos, y no incluye a las empresas. Los datos de País Vasco y Navarra entran tarde en la serie (Navarra desde 2021, Gipuzkoa desde 2022, Álava y Bizkaia en 2024), así que en esos territorios no se puede calcular la subida a cinco años. El Catastro mide la concentración dentro de cada municipio: una empresa con 300 viviendas repartidas en 30 municipios cuenta como titular de 10 en cada uno. No hay datos oficiales por barrio para toda España.</p>`)}
  </section>`;
}

function concentracionHTML() {
  const U = D.mun, Ci = D.inversion.concentracion_local || [], g = U.grupos;
  return `<section class="lectura" aria-labelledby="conc-t">
    <h3 id="conc-t">Concentración de la propiedad y precio</h3>
    <div class="lect-grid">
      <article class="ancho"><p>Para que un propietario pueda subir el precio sin perder inquilinos tiene que controlar una parte grande de la oferta en la zona en la que buscan casa. Si tiene un 5 % y el resto está repartido entre muchos pequeños propietarios, quien busca casa tiene alternativas. Por eso importa la <strong>concentración por zona</strong>, no solo el total que tiene cada empresa en España.</p></article>
      <article><h4>Por municipio</h4><p>En el conjunto de municipios con datos del Catastro, los propietarios que tienen más de 10 viviendas en el mismo municipio son titulares del <strong>${pct(U.nac_cat.mas10)}</strong> de las viviendas, y los que tienen más de 100, del ${pct(U.nac_cat.mas100)}. Las empresas son titulares del ${pct(U.nac_cat.pj)}. Los valores más altos están sobre todo en municipios turísticos de Canarias y Baleares, donde hay complejos de apartamentos de un solo propietario.</p>
        <div class="tabla"><table class="num"><thead><tr><th scope="col">Municipio</th><th scope="col">Más de 10</th><th scope="col">Más de 100</th><th scope="col">Empresas</th></tr></thead>
        <tbody>${U.top_conc.slice(0, 8).map(f => `<tr><th scope="row">${esc(f.n)}</th><td>${pct(f.mas10)}</td><td>${pct(f.mas100)}</td><td>${pct(f.pj)}</td></tr>`).join("")}</tbody></table></div>
        <p class="note">Municipios con más de 10.000 inmuebles residenciales. Catastro, ${U.catastro_anyo}.</p></article>
      <article><h4>¿Coincide con la tensión?</h4><p>En los ${U.n_grandes} municipios con al menos ${nf0.format(U.min_comp)} viviendas alquiladas, los que cumplían el criterio de subida en ${U.ult} tienen un <strong>${pct(g.si.mas10)}</strong> de viviendas de propietarios con más de 10, frente al <strong>${pct(g.no.mas10)}</strong> de los que no lo cumplían. En pisos turísticos, ${pct(g.si.vut)} frente a ${pct(g.no.vut)}. ${relTxt(U.rho.exc.mas10, "la subida del alquiler", "la concentración de la propiedad")} ${relTxt(U.rho.exc.vut, "la subida", "el peso de los pisos turísticos")} ${relTxt(U.rho.esf.pj, "el nivel del alquiler frente a la renta", "el porcentaje de viviendas de empresas")}</p></article>
      <article><h4>En algunas ciudades</h4><p>Algunas comunidades tienen registros de fianzas de alquiler que permiten saber quién es el propietario de las viviendas alquiladas. Solo se han publicado análisis para unas pocas ciudades. ${Ci.map(x => `${x.texto} (<a href="${x.fuente}" target="_blank" rel="noopener">${x.fuente_txt}</a>${x.oficial ? "" : "; sin carácter oficial"}).`).join(" ")}</p></article>
    </div>
    ${avisoHTML("Qué no dice", "Concentración no es lo mismo que poder para fijar el precio",
      `<p>La prueba directa sería comparar lo que cobran los grandes propietarios con lo que cobran los pequeños por viviendas parecidas en la misma zona. Ninguna estadística oficial publica el alquiler según el tipo de propietario. El Catastro registra al titular del IBI, que puede no ser el propietario pleno, y cuenta inmuebles de uso residencial, que no son exactamente viviendas. Una relación entre concentración y precio en el mismo municipio tampoco diría qué causa qué: las empresas compran más donde los alquileres ya son altos.</p>`)}
  </section>`;
}

function relTxt(r, a, b) {
  const f = Math.abs(r) < 0.1 ? `no tiene relación con ${b}` : Math.abs(r) < 0.3 ? `tiene una relación ${r > 0 ? "positiva" : "negativa"} débil con ${b}` : `tiene una relación ${r > 0 ? "positiva" : "negativa"} moderada con ${b}`;
  return `Ordenando los municipios, ${a} ${f} (correlación de rangos ${nf1.format(r).replace(/^-/, "−")}).`;
}

function analisisHTML(d) {
  const { C, i, U } = invCompras(), Mu = D.mun, g = Mu.grupos, PA = D.inversion.precio_alquiler;
  const a19 = 2019, e19 = C.empresas[i(a19)], eU = C.empresas[i(U)], n19 = C.no_residentes[i(a19)], nU = C.no_residentes[i(U)];
  const subeP = varPct(C.precio[i(a19)], C.precio[i(U)]);
  const brecha = d.sH - d.sV, anos = `${d.H.anos[0]} y ${ult(d.H.anos)}`;
  const art = (t, x) => `<article><h4>${t}</h4><p>${x}</p></article>`;
  const cambio = (a, b) => Math.abs(b - a) < 1 ? "casi igual" : b > a ? "más" : "menos";
  const concMenos = g.si.mas10 <= g.no.mas10;
  return `<section class="lectura" aria-labelledby="ana-t">
    <h3 id="ana-t">Análisis final: inversión, concentración y precio</h3>
    <p class="note">Separamos dos preguntas: si las compras de inversión explican la subida del precio en el conjunto de España, y si en algunos lugares la concentración de la propiedad coincide con la tensión del alquiler.</p>
    <div class="lect-grid">
      ${art("1 · Compras de inversión y precio", `Entre ${a19} y ${U} el precio de compra subió un ${pctE(subeP)}. En esos años, las empresas pasaron del ${pct(e19)} al ${pct(eU)} de las compras (${cambio(e19, eU)}), los no residentes del ${pct(n19)} al ${pct(nU)} (${cambio(n19, nU)}) y las hipotecas por cada 100 compraventas se mantuvieron entre ${invCompras().hMin} y ${invCompras().hMax}. La subida reciente no coincide con un aumento del peso de estas compras a escala nacional.`)}
      ${art("2 · Precio frente a alquiler", `El precio de compra ha subido más que el alquiler vigente desde 2015 (${pctE(ult(PA.compra) - 100)} frente a ${pctE(ult(PA.alquiler) - 100)}). Es compatible con compras que esperan revalorización, pero también con el crédito barato hasta 2021 y con que el índice del alquiler sube despacio por cómo se calcula.`)}
      ${art("3 · Dónde hay tensión", `En ${Mu.ult} cumplían el criterio legal de subida del alquiler ${nf0.format(Mu.cumplen[Mu.ult])} de los ${nf0.format(Mu.evaluables[Mu.ult])} municipios con datos, con los porcentajes más altos en ${Mu.ccaa_top.map(([c, s]) => `${c} (${pctE(s)})`).join(", ")}. Es un fenómeno extendido, no limitado a unos pocos barrios.`)}
      ${art("4 · Concentración y tensión", `Entre los municipios con al menos ${nf0.format(Mu.min_comp)} viviendas alquiladas, los que cumplen el criterio tienen ${concMenos ? "menos" : "más"} concentración de la propiedad que los que no lo cumplen (${pct(g.si.mas10)} frente a ${pct(g.no.mas10)} de viviendas de propietarios con más de 10). En pisos turísticos tienen ${g.si.vut > g.no.vut ? "más" : "menos"}: ${pct(g.si.vut)} frente a ${pct(g.no.vut)}.`)}
      ${art("5 · Comparación con otros factores", `Entre ${anos} se formaron unos ${milesR(brecha)} hogares más que viviendas terminadas. Es un factor que afecta a todo el país, como la tensión del alquiler.`)}
      ${art("6 · Lo que no se puede medir", "No hay datos oficiales de cuántas viviendas se compran para revender, de la propiedad por barrio en toda España ni de lo que cobran los grandes propietarios frente a los pequeños. Sin esos datos no se puede medir el efecto de un propietario concreto en el precio de un barrio.")}
    </div>
    ${avisoHTML("Lo que permiten concluir los datos", concMenos && Math.abs(Mu.rho.exc.mas10) < 0.3 ? "La tensión del alquiler está extendida y no se concentra donde hay más grandes propietarios" : "La tensión del alquiler está extendida; su relación con la concentración es limitada",
      `<p>A escala nacional, el peso de las compras de inversión no ha crecido durante la subida reciente del precio. A escala municipal, el alquiler subió más que el IPC + 3 puntos en el ${pctE(100 * Mu.cumplen[Mu.ult] / Mu.evaluables[Mu.ult])} de los municipios con datos en ${Mu.ult}, y esa subida ${concMenos ? "no es mayor" : "es algo mayor"} donde hay más viviendas en manos de grandes propietarios; ${g.si.vut > g.no.vut ? "coincide algo más con los pisos turísticos" : "tampoco coincide con los pisos turísticos"}. Estos datos no apuntan a que la inversión o la concentración de la propiedad sean la causa principal de la subida del precio en España. No permiten descartar que un gran propietario influya en el precio de un barrio concreto donde concentra mucha oferta: para medirlo harían falta datos de propiedad por barrio y de precios según el tipo de propietario, que hoy no se publican.</p>`)}
  </section>`;
}

function regulacionHTML() {
  const ESTADO = { vigente: "Vigente", derogada: "Derogada", anulada_parte: "Anulada en parte" };
  const fecha = f => `${MES_CORTO[+f.slice(5, 7) - 1]} ${f.slice(0, 4)}`;
  return `<section class="lectura" aria-labelledby="reg-t">
    <h3 id="reg-t">Regulación de la inversión en vivienda</h3>
    <p class="note">Normas estatales y europeas sobre quién puede comprar, cómo tributa y qué puede hacer con la vivienda, ordenadas por fecha. No incluye normas autonómicas ni municipales, como las declaraciones de zonas tensionadas o las limitaciones locales de pisos turísticos.</p>
    <ol class="normas">${D.inversion.normas.map(n => `<li>
      <span class="nfecha num">${fecha(n.fecha)}</span>
      <div class="ncuerpo">
        <div class="nchips"><span class="nchip est-${n.estado}">${ESTADO[n.estado]}</span></div>
        <h4>${n.nombre}</h4>
        <p>${n.cambio}${n.estado_nota ? ` <em>${n.estado_nota}</em>` : ""}</p>
        <a href="${n.fuente}" target="_blank" rel="noopener">Fuente: ${n.fuente_txt}</a>
      </div></li>`).join("")}</ol></section>`;
}

/* ---- aviso: el dato de 2021 es dudoso ---- */
function avisoDuda(d) {
  const Q = d.R.origen.duda;
  if (!Q || !Q.ano) return "";
  const a = Q.ano, fila = (n, x) => `<tr><th scope="row">${n}</th><td><strong>+${milesR(x.total)}</strong></td><td>+${milesR(x.pob)} personas</td><td>~${milesR(x.tam)}</td></tr>`;
  return `<section class="aviso" aria-labelledby="duda-t">
    <div class="aviso-cab"><span class="chip-aviso"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 21h20L12 3z"></path><path d="M12 10v5M12 18v.5"></path></svg>Dato dudoso</span>
      <h3 id="duda-t">Cuidado con ${a}: el salto de hogares es real, pero no se sabe de qué tamaño</h3></div>
    <p>En ${a - 1}, con el confinamiento, casi no se formaron hogares (unos ${milesR(Q.mivau_antes)}): mucha gente volvió a casa de sus padres o retrasó independizarse. En ${a} se forman muchos más hogares de los que explica el crecimiento de la población. Las dos fuentes lo muestran, pero no coinciden en cuánto:</p>
    <div class="tabla"><table class="num"><thead><tr><th scope="col">Fuente</th><th scope="col">Hogares nuevos en ${a}</th><th scope="col">Crecimiento de la población</th><th scope="col">Por hogares más pequeños</th></tr></thead>
      <tbody>${fila("INE (serie nueva, primer año)", Q.ine)}${fila("Ministerio de Vivienda (estimación)", Q.mivau)}</tbody></table></div>
    <div class="lect-grid">
      <article><h4>Qué es seguro</h4><p>Que en ${a} aumentaron los hogares bastante más que la población: lo muestran las dos fuentes.</p></article>
      <article><h4>Qué no es seguro</h4><p>Cuánto. El efecto de los hogares más pequeños puede estar entre unos ${milesR(Q.mivau.tam)} y unos ${milesR(Q.ine.tam)}. Con los datos públicos no se puede separar la parte real de la estadística.</p></article>
      <article><h4>Qué no cambia</h4><p>La conclusión de fondo: desde ${a + 1} la inmigración es el motor y se terminan muchas menos viviendas que hogares nuevos, según las dos fuentes.</p></article>
      <article class="ancho"><h4>Explicaciones posibles, de más a menos sólida</h4><ol class="tres">
        <li><strong>El rebote de ${a - 1}.</strong> Quien retrasó independizarse durante el confinamiento lo hizo en ${a}, con el interés de las hipotecas en el ${nf1.format(Q.interes)} %, el más bajo de la serie. Las hipotecas sobre vivienda pasaron de ${milesR(Q.hip_antes)} a ${milesR(Q.hip)} (${signoE(varPct(Q.hip_antes, Q.hip))}).</li>
        <li><strong>Más personas solas por la mortalidad de la covid.</strong> Cuando muere un miembro de una pareja mayor, el hogar sigue existiendo con una persona menos. Pesa poco, porque muchos fallecidos vivían en residencias, que no cuentan como hogares.</li>
        <li><strong>Cambios por el teletrabajo.</strong> Personas que pasan a vivir de forma habitual en su segunda residencia o que dejan de compartir piso.</li>
        <li><strong>Un efecto estadístico.</strong> ${a} es el primer año de la serie nueva del INE, construida a partir del Censo de ${a}. Que el Ministerio estime menos de la mitad apunta a que parte del salto puede ser de medición, no real.</li>
      </ol></article>
    </div></section>`;
}

/* ---- resumen de los últimos 8 años de hogares ---- */
function ochoAnos(d) {
  const R = d.R.origen, LG = d.R.largo, n = Math.min(8, R.anos.length), i0 = R.anos.length - n;
  const anos = R.anos.slice(i0), viv = a => LG.viviendas[LG.anos.indexOf(a)];
  const idx = anos.map((a, k) => i0 + k), aIne = R.anos[R.fuente.indexOf("ine")];
  const sumH = suma(idx.map(i => R.total[i])), sumV = suma(anos.map(viv));
  const prom = (ii, f) => { const v = ii.map(f).filter(x => x != null); return v.length ? suma(v) / v.length : null; };
  const antes = idx.filter(i => R.anos[i] < aIne), ini = idx.filter(i => R.anos[i] === aIne);
  const despues = idx.filter(i => R.anos[i] > aIne && R.extranjeros[i] != null), sinDes = idx.filter(i => R.anos[i] > aIne && R.extranjeros[i] == null);
  const tam2 = v => new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  const mil = v => v == null ? "—" : (v < 0 ? "−" : v > 0 ? "+" : "") + milesR(Math.abs(v));
  const rango = ii => ii.length > 1 ? `${R.anos[ii[0]]}–${R.anos[ult(ii)]}` : `${R.anos[ii[0]]}`;
  const sumHi = (ii) => suma(ii.map(i => R.total[i])), sumVi = ii => suma(ii.map(i => viv(R.anos[i])));
  const ext = despues.map(i => R.extranjeros[i]);
  const fila = i => { const a = R.anos[i];
    return `<tr><th scope="row">${a}${R.fuente[i] === "ine" && a === aIne ? " <small>desde aquí, INE · dato dudoso</small>" : ""}</th>
      <td><strong>${milesR(R.total[i])}</strong></td><td>${milesR(viv(a))}</td>
      <td>${R.extranjeros[i] == null ? '<small>sin desglose</small>' : mil(R.extranjeros[i])}</td>
      <td>${R.espanoles[i] == null ? '<small>sin desglose</small>' : mil(R.espanoles[i])}</td>
      <td>${R.natural[i] == null ? '<small>sin desglose</small>' : mil(R.natural[i])}</td>
      <td>${mil(R.tamano[i])}</td><td>${tam2(R.tam_medio[i])}</td></tr>`; };
  return `<section class="lectura" aria-labelledby="ocho-t">
    <h3 id="ocho-t">Los últimos ${n} años (${anos[0]}–${ult(anos)})</h3>
    <p class="resp">En ${n} años se formaron unos <strong>${millones(sumH)} de hogares</strong> y se terminaron unas <strong>${milesR(sumV)} viviendas</strong>, ${nf1.format(sumH / sumV)} hogares por cada vivienda nueva. Pero casi todo el desajuste se concentra desde ${aIne}.</p>
    <div class="tabla"><table class="num ocho"><thead><tr><th scope="col">Año</th><th scope="col">Hogares nuevos</th><th scope="col">Viviendas terminadas</th><th scope="col">Por saldo de extranjeros</th><th scope="col">Por saldo de españoles</th><th scope="col">Por nacimientos menos defunciones y otros</th><th scope="col">Por hogares más pequeños</th><th scope="col">Personas por hogar</th></tr></thead>
    <tbody>${idx.map(fila).join("")}</tbody></table></div>
    <div class="lect-grid">
      ${antes.length ? `<article><h4>${rango(antes)}: llega gente, pero apenas se forman hogares</h4><p>La inmigración crece, pero los hogares nuevos se quedan en unos ${milesR(prom(antes, i => R.total[i]))} al año, porque el tamaño del hogar sube un poco (de ${tam2(R.tam_medio[antes[0] - 1] ?? R.tam_medio[antes[0]])} a ${tam2(R.tam_medio[ult(antes)])} personas): más gente comparte piso o no se independiza. Se terminan más viviendas que hogares nuevos (${milesR(sumVi(antes))} frente a ${milesR(sumHi(antes))}), así que no hay presión por este lado.</p></article>` : ""}
      ${ini.length ? `<article><h4>${aIne}: un salto dudoso</h4><p>Tras un ${aIne - 1} en el que casi no se formaron hogares, en ${aIne} se forman muchos más de lo que crece la población: ${milesR(R.total[ini[0]])} según el INE, la mayoría por hogares más pequeños, y ${milesR(R.duda.mivau.total)} según la estimación del Ministerio. Hay un efecto real, pero su tamaño es incierto (ver el aviso de arriba).</p></article>` : ""}
      ${despues.length ? `<article><h4>${rango(despues)}: la inmigración marca el ritmo</h4><p>Unos ${milesR(prom(despues, i => R.total[i]))} hogares nuevos al año. El saldo de extranjeros aporta entre ${milesR(Math.min(...ext))} y ${milesR(Math.max(...ext))}, y los nacimientos menos defunciones restan unos ${milesR(-prom(despues, i => R.natural[i]))}. El tamaño del hogar se estanca en ${tam2(R.tam_medio[ult(despues)])} personas. Se forman ${nf1.format(sumHi(despues) / sumVi(despues))} hogares por cada vivienda terminada.</p></article>` : ""}
      ${sinDes.length ? `<article><h4>${rango(sinDes)}: todavía sin desglose</h4><p>${milesR(R.total[sinDes[0]])} hogares nuevos frente a ${milesR(viv(R.anos[sinDes[0]]))} viviendas. El tamaño medio vuelve a bajar (${tam2(R.tam_medio[sinDes[0]])} personas) y aporta ${milesR(R.tamano[sinDes[0]])}; el resto, ${milesR(R.poblacion_sin_desglose[sinDes[0]])}, se debe a más población, a falta de que el INE publique las migraciones de ese año.</p></article>` : ""}
      <article class="ancho"><h4>La tendencia, en tres frases</h4><ol class="tres"><li>Hasta ${aIne - 1}, la vivienda nueva bastaba: se formaban pocos hogares porque se compartía más vivienda.</li><li>Desde ${aIne} se forman unos ${milesR(prom(idx.filter(i => R.anos[i] >= aIne), i => R.total[i]))} hogares al año, primero por un salto en ${aIne} de tamaño incierto y desde ${aIne + 1} por la llegada de población del extranjero.</li><li>La construcción apenas ha cambiado (de ${milesR(viv(anos[0]))} a ${milesR(viv(ult(anos)))} viviendas al año), así que desde ${aIne} se acumula un hueco de unos ${milesR(prom(idx.filter(i => R.anos[i] >= aIne), i => R.total[i] - viv(R.anos[i])))} hogares al año que tienen que salir de viviendas que ya existían.</li></ol>
      <p class="note">${sinDes.length ? `Los hogares de ${R.anos[sinDes[0]]} se reparten solo entre más población y hogares más pequeños: falta el desglose por nacionalidad. ` : ""}Las columnas de origen suman el total de hogares nuevos; las de los años hasta ${aIne - 1} usan la estimación del Ministerio.</p></article>
    </div></section>`;
}

/* ---- contenido de cada paso ---- */
function textoSuelo(d) {
  const S = d.K.suelo_19, V = d.P.comparar[2019];
  return `El suelo urbano se vende a ${nf0.format(d.suU)} €/m² de media, un ${pctE(S.nominal)} más que en 2019 en los mismos trimestres; descontando la inflación, un ${pctE(Math.abs(S.real))} ${S.real < 0 ? "más barato" : "más caro"}. La vivienda, en cambio, se ha encarecido un ${pctE(V.real)} descontando la inflación, así que el suelo no explica la subida.`;
}
function interesReal(d) {
  const r = d.Cr.anos.map((a, i) => Math.round(10 * (d.Cr.interes[i] - d.Cr.inflacion[i])) / 10);
  const desde = d.Cr.anos.indexOf(2019);
  let iMin = desde; for (let i = desde; i < r.length; i++) if (r[i] < r[iMin]) iMin = i;
  let i0 = iMin, i1 = iMin;
  while (i0 - 1 >= desde && r[i0 - 1] < 0) i0--;
  while (i1 + 1 < r.length && r[i1 + 1] < 0) i1++;
  return { r, iMin, a0: d.Cr.anos[i0], a1: d.Cr.anos[i1] };
}
const C1 = "var(--s1)", C2 = "var(--s2)", C3 = "var(--s3)", C4 = "var(--s4)";

function datosPasos() {
  const P = RC.precio, k = P.anos.length - 1, ia = a => P.anos.indexOf(a);
  const subeViv = P.vivienda[k] - 100, subeSal = P.sueldos[k] - 100, subeIpc = P.ipc[k] - 100;
  const caida = varPct(P.vivienda[ia(2008)], P.vivienda[ia(2013)]);
  const H = RC.hogares, sH = suma(H.hogares), sV = suma(H.viviendas);
  const C = RC.construccion, tot = C.anos.map((_, i) => (C.libres[i] || 0) + (C.protegidas[i] || 0));
  const iPico = tot.indexOf(Math.max(...tot)), iMin = tot.indexOf(Math.min(...tot.slice(iPico)));
  const ultIni = ult(C.iniciadas);
  let desdeIni = null;
  for (let i = C.anos.length - 2; i >= 0; i--) if (C.iniciadas[i] >= ultIni) { desdeIni = C.anos[i]; break; }
  const K = RC.costes, ik = a => K.anos.indexOf(a);
  const oMin = Math.min(...K.ocupados), aMin = K.anos[K.ocupados.indexOf(oMin)];
  const su19 = K.suelo[K.suelo_anos.indexOf(2019)], suU = ult(K.suelo);
  const Cr = RC.credito, ic = a => Cr.anos.indexOf(a), ih = a => Cr.hipo_anos.indexOf(a);
  const iMinInt = Cr.interes.indexOf(Math.min(...Cr.interes.slice(ic(2015))));
  const iMaxInt = Cr.interes.indexOf(Math.max(...Cr.interes.slice(iMinInt)));
  const aMaxInt = Cr.anos[iMaxInt], aMinInt = Cr.anos[iMinInt];
  const hipoComp = Cr.hipo_anos.filter((a, i) => a < Cr.hipo_anos[Cr.hipo_anos.length - 1] || Cr.hipo_meses === 12);
  const aH = ult(hipoComp), hU = Cr.hipotecas[ih(aH)];
  let desdeH = null;
  for (let i = ih(aH) - 1; i >= 0; i--) if (Cr.hipotecas[i] >= hU) { desdeH = Cr.hipo_anos[i]; break; }
  // el año, desde el mínimo de tipos, en que más cayeron las hipotecas
  let caeH = 0, anoCaeH = aMaxInt;
  for (let a = aMinInt + 1; a <= aH; a++) {
    const c = varPct(Cr.hipotecas[ih(a - 1)], Cr.hipotecas[ih(a)]);
    if (c < caeH) { caeH = c; anoCaeH = a; }
  }
  const subeVivAnoCae = varPct(P.vivienda[ia(anoCaeH - 1)], P.vivienda[ia(anoCaeH)]);
  const E = D.empresas, eU = ult(E), eMax = E.reduce((a, b) => b[1] > a[1] ? b : a);
  const top = id => { const pr = D.capas[id].prov; const c = Object.keys(pr).reduce((a, b) => pr[b] > pr[a] ? b : a); return { cod: c, v: pr[c] }; };
  const RO = RC.origen, conMig = RO.anos.map((a, i) => RO.fuente[i] === "ine" && RO.extranjeros[i] != null && a > RO.anos[RO.fuente.indexOf("ine")] ? i : -1).filter(i => i >= 0);
  const ext = conMig.map(i => RO.extranjeros[i]);
  const O = { a1: RO.anos[conMig[0]], extMed: suma(ext) / ext.length, extMin: Math.min(...ext), extMax: Math.max(...ext) };
  const R = RC, LG = RC.largo;
  const media = (a0, a1, k) => { const v = LG.anos.map((a, i) => a >= a0 && a <= a1 ? LG[k][i] : null).filter(x => x != null); return suma(v) / v.length; };
  const L = { b: { h: media(2002, 2008, "hogares"), v: media(2002, 2008, "viviendas") }, c: { h: media(2012, 2020, "hogares"), v: media(2012, 2020, "viviendas") } };
  return { L, O, R, P, k, subeViv, subeSal, subeIpc, caida, H, sH, sV, C, tot, iPico, iMin, ultIni, desdeIni, K, ik, oMin, aMin, su19, suU,
           Cr, aMinInt, aMaxInt, iMinInt, iMaxInt, aH, hU, desdeH, caeH, anoCaeH, subeVivAnoCae, eU, eMax, top };
}

const PASOS = [
  { id: "precio", precios: true, corto: "El precio", eyebrow: "Punto de partida",
    q: "Precio de la vivienda frente a los sueldos",
    resp: d => { const a = d.P.comparar[2008], b = d.P.comparar[2019];
      if (enReal()) return `Descontando la inflación, comprar una vivienda cuesta hoy un <strong>${pctE(Math.abs(a.real))} ${a.real < 0 ? "menos" : "más"} que en 2008</strong> y un <strong>${pctE(b.real)} más que en 2019</strong>. Los sueldos, en cambio, apenas han ganado poder de compra: ${signoE(a.sueldos_real)} desde 2008 y ${signoE(b.sueldos_real)} desde 2019.`;
      return `En relación con los sueldos, comprar una vivienda cuesta hoy <strong>casi lo mismo que en 2008</strong>, antes de la crisis. Lo que ha cambiado son los últimos años: <strong>desde 2019, la vivienda ha subido más que los sueldos</strong> (${signoE(b.vivienda)} frente a ${signoE(b.sueldos)}).`; },
    expl: d => `Entre ${d.P.crisis.pico.slice(0, 4)} y ${d.P.crisis.suelo.slice(0, 4)} el precio cayó un ${pctE(-d.P.crisis.caida)} y desde entonces ha recuperado ese terreno. Por eso la subida parece moderada o enorme según el año desde el que se mire. Debajo explicamos cómo leer la comparación; los pasos siguientes repasan qué empuja el precio.`,
    lectura: d => {
      const C = d.P.comparar, n = d.P.trims.length;
      const sem = n === 2 ? "primer semestre" : n === 1 ? "primer trimestre" : `los ${n} primeros trimestres`;
      const fila = (b, nota) => `<tr${b === 2008 || b === 2019 ? ' class="dest"' : ""}><th scope="row">${b}${nota ? ` <small>${nota}</small>` : ""}</th><td>${signoE(C[b].vivienda)}</td><td>${signoE(C[b].sueldos)}</td><td>${signoE(C[b].ipc)}</td><td><strong>${signoE(C[b].frente_sueldo)}</strong></td><td>${signoE(C[b].real)}</td></tr>`;
      return `<section class="lectura" aria-labelledby="lect-t">
        <h3 id="lect-t">Cómo leer esta comparación</h3>
        <div class="lect-grid">
          <article class="ancho"><h4>El año de partida cambia el resultado</h4>
            <p>Comparar con 2013 o 2015, el fondo de la crisis, hace que la subida parezca mucho mayor que si se compara con 2008 o con 2019.</p>
            <div class="tabla"><table class="num">
              <thead><tr><th scope="col">Desde</th><th scope="col">Vivienda</th><th scope="col">Sueldos</th><th scope="col">Precios (IPC)</th><th scope="col">Vivienda frente a sueldos</th><th scope="col">Vivienda descontando inflación</th></tr></thead>
              <tbody>${fila(2008, "antes de la crisis")}${fila(2013, "fondo de la crisis")}${fila(2015, "")}${fila(2019, "antes de la covid")}</tbody>
            </table></div></article>
          <article><h4>Descontando la inflación</h4>
            <p>Si se resta lo que han subido el resto de precios, la vivienda está un ${pctE(Math.abs(C[2008].real))} ${C[2008].real < 0 ? "más barata" : "más cara"} que en 2008 y un ${pctE(C[2019].real)} más cara que en 2019.</p></article>
          <article><h4>Mismos meses en los dos años</h4>
            <p>Las cifras comparan el ${sem} de ${d.P.ano_f} con el ${sem} de cada año de partida, para que la época del año no altere el resultado.</p></article>
          <article><h4>Precio no es lo mismo que poder pagarlo</h4>
            <p>Lo que nota una familia es la cuota de la hipoteca frente a sus ingresos, que depende también del tipo de interés (lo vemos en el <a href="#vivienda-credito">paso del crédito</a>). Además, aquí se usa el sueldo medio por trabajador, no los ingresos de cada hogar.</p></article>
        </div></section>`;
    },
    det: d => `<p><strong>Vivienda:</strong> Índice de Precios de Vivienda del INE, a partir de compraventas ante notario y a calidad constante (compara viviendas parecidas). <strong>Sueldos:</strong> coste salarial bruto por trabajador y mes (INE, Encuesta Trimestral de Coste Laboral). <strong>Precios:</strong> IPC general. El gráfico usa medias anuales y ${d.P.ano_f} incluye solo los trimestres publicados; las cifras del texto comparan los mismos meses.</p>
      <p><strong>Qué no dice:</strong> no incluye el alquiler. El índice oficial de alquiler del INE subió un ${pctE(D.capas.alquiler.nacional)} entre 2015 y 2024, casi lo mismo que el resto de precios (${pctE(D.inflacion.alquiler_ipc)}), pero mide todos los contratos vigentes y no solo los nuevos, que suben más.</p>`,
    base: 2008,
    chart: (d, el) => {
      const P = d.P, paso = PASOS[0], bases = [2008, 2015, 2019];
      el.innerHTML = `<div class="basebar"><span>Comparar desde</span><div class="seg mini" role="group" aria-label="Año de partida">${bases.map(b => `<button type="button" data-b="${b}" aria-pressed="${b === paso.base}">${b}</button>`).join("")}</div><span class="baseres" id="baseres"></span></div><div class="chart" id="c-precio"></div>`;
      const pinta = () => {
        const b = paso.base, i0 = P.anos.indexOf(b);
        // el último año (incompleto) se compara con los mismos meses del año base, igual que el texto
        const c0 = P.comparar[b], R = enReal();
        const fin = R ? { vivienda: c0.real, sueldos: c0.sueldos_real } : { vivienda: c0.vivienda, sueldos: c0.sueldos, ipc: c0.ipc };
        const def = arr => R ? arr.map((v, i) => v == null || P.ipc[i] == null ? null : v / P.ipc[i]) : arr;
        const re = (arr0, k) => { const arr = def(arr0); return arr.map((v, i) => v == null ? null : i === d.k ? Math.round(10 * (100 + fin[k])) / 10 : Math.round(1000 * v / arr[i0]) / 10); };
        const iP = P.anos.indexOf(+P.crisis.pico.slice(0, 4)), iS = P.anos.indexOf(+P.crisis.suelo.slice(0, 4));
        grafico($("c-precio"), { tipo: "lineas", alto: 300, x: P.anos.map((a, i) => i === d.k ? a + "*" : a),
          series: R ? [{ n: "Precio de compra de vivienda, descontando inflación", v: re(P.vivienda, "vivienda"), c: C1 }, { n: "Sueldos, descontando inflación", v: re(P.sueldos, "sueldos"), c: C2 }]
                    : [{ n: "Precio de compra de vivienda", v: re(P.vivienda, "vivienda"), c: C1 }, { n: "Sueldos", v: re(P.sueldos, "sueldos"), c: C2 }, { n: "Resto de precios (IPC)", v: re(P.ipc, "ipc"), c: C3 }],
          y: { ref: 100, fmt: v => nf0.format(v) }, aria: `Índices de precio de vivienda, sueldos e IPC, ${b} = 100`,
          bandas: [{ i0: Math.max(0, iP), i1: iS, t: `Crisis de la vivienda (${P.crisis.pico.slice(0, 4)}–${P.crisis.suelo.slice(0, 4)})` }],
          tipFmt: v => nf0.format(v) + (R ? ` (${signoE(v - 100)} frente al resto de precios desde ${b})` : ` (${signoE(v - 100)} desde ${b})`) });
        const c = P.comparar[b];
        $("baseres").innerHTML = R
          ? `Desde ${b}, descontando la inflación: vivienda <strong>${signoE(c.real)}</strong> · sueldos <strong>${signoE(c.sueldos_real)}</strong>`
          : `Desde ${b}: vivienda <strong>${signoE(c.vivienda)}</strong> · sueldos <strong>${signoE(c.sueldos)}</strong> · precios <strong>${signoE(c.ipc)}</strong>`;
        for (const bt of el.querySelectorAll("[data-b]")) bt.setAttribute("aria-pressed", +bt.dataset.b === b);
        el.closest("figure").querySelector("figcaption").textContent = (R
          ? `${b} = 100, descontando la inflación: por encima de 100, ha subido más que el resto de precios; por debajo, menos. `
          : `${b} = 100. `) + `*Último año con datos parciales. La franja sombreada marca la crisis de la vivienda, cuando el precio cayó un ${pctE(-P.crisis.caida)}${R ? " (sin descontar la inflación)" : ""}. El índice de precios de vivienda del INE empieza en ${P.anos[0]} y el de sueldos en 2008: antes no hay series oficiales comparables.`;
      };
      el.querySelector(".basebar").addEventListener("click", e => { const bt = e.target.closest("[data-b]"); if (bt) { paso.base = +bt.dataset.b; pinta(); } });
      pinta();
    },
    pie: "" },

  { id: "hogares", corto: "Hogares", eyebrow: "Componente 1 · Cuánta gente busca casa",
    q: "Hogares nuevos y viviendas terminadas",
    resp: d => { const L = d.L;
      return `Entre ${d.H.anos[0]} y ${ult(d.H.anos)} se formaron <strong>${millones(d.sH)} de hogares</strong> y se terminaron <strong>${milesR(d.sV)} viviendas</strong>: ${nf1.format(d.sH / d.sV)} hogares nuevos por cada vivienda nueva. No siempre fue así: entre 2002 y 2008 se terminaban más viviendas que hogares nuevos (${milesR(L.b.v)} frente a ${milesR(L.b.h)} al año) y entre 2012 y 2020 las dos cifras eran bajas y parecidas (${milesR(L.c.v)} y ${milesR(L.c.h)}).`; },
    expl: d => `Cada hogar ocupa, por definición, una vivienda. Así que esos ${millones(d.sH)} de hogares sí encontraron casa: unas ${milesR(d.sV)} eran nuevas y el resto, unas ${milesR(d.sH - d.sV)}, eran viviendas que ya existían y pasaron a usarse como residencia habitual (pisos vacíos, segundas residencias, pisos turísticos que vuelven a alquilarse o viviendas divididas). Cuando la demanda tiene que cubrirse con casas ya existentes, compite por ellas y el precio sube. Lo que esta cifra no ve son los hogares que no llegan a formarse, como los jóvenes que querrían independizarse y no pueden.`,
    lectura: () => `<section class="lectura" aria-labelledby="def-hogar">
        <h3 id="def-hogar">Qué es un hogar</h3>
        <div class="lect-grid">
          <article class="ancho"><p>Para el INE, un hogar es <strong>el conjunto de personas que viven habitualmente en la misma vivienda</strong>, sean o no familia. Un hogar equivale a una vivienda ocupada como residencia habitual.</p></article>
          <article><h4>Sí es un hogar</h4><p>Una persona que vive sola. Una pareja con sus hijos. Tres estudiantes que comparten piso: son un solo hogar, aunque no sean familia.</p></article>
          <article><h4>No es un hogar nuevo</h4><p>Un joven que sigue viviendo con sus padres: forma parte del hogar de ellos. Si alguien se muda a un piso compartido que ya existía, tampoco crea un hogar.</p></article>
          <article><h4>No cuenta</h4><p>Residencias de mayores, cuarteles, conventos o cárceles. No son viviendas familiares, así que quedan fuera de esta estadística.</p></article>
        </div></section>`,
    det: () => `<p><strong>Hogares:</strong> desde 2021, diferencia entre el 1 de enero de cada año y el 1 de enero siguiente (INE, Estadística Continua de Población, que empieza en 2021). De 2002 a 2020, variación de las viviendas principales que estima el Ministerio de Vivienda a partir de los censos de 2001, 2011 y 2021. Son fuentes distintas, por eso el gráfico marca el cambio. <strong>Viviendas:</strong> libres terminadas (certificados de fin de obra) más protegidas (calificaciones definitivas), del Ministerio de Vivienda.</p>
      <p><strong>Qué no dice:</strong> la comparación mide presión sobre las viviendas que ya existen, no un déficit exacto. Tampoco cuenta la demanda de quienes no llegan a formar un hogar. Más abajo se desglosa el origen de estos hogares nuevos.</p>`,
    chart: (d, el) => { const L = d.R.largo, i11 = L.anos.indexOf(2011), i21 = L.fuente.indexOf("ine");
      grafico(el, { tipo: "barras", alto: 300, x: L.anos,
      series: [{ n: "Hogares nuevos", v: L.hogares, c: C2 }, { n: "Viviendas terminadas", v: L.viviendas, c: C1 }],
      bandas: [{ i0: 0, i1: L.anos.indexOf(2008), t: "Burbuja (2002–2008)" }],
      marcas: [{ i: i11, t: "Ajuste al censo de 2011", fila: 1 }, { i: i21, t: "Desde aquí, datos del INE · 2021 dudoso", fila: 2 }],
      y: { fmt: v => v === 0 ? "0" : nf0.format(v / 1000) + " mil" }, ml: 54, tipFmt: v => nf0.format(v),
      tipExtra: i => (L.hogares[i] > 0 ? `<span class="tx">${nf1.format(L.hogares[i] / L.viviendas[i])} hogares por vivienda · ${L.fuente[i] === "ine" ? "hogares: INE" : "hogares: estimación del Ministerio"}</span>` : "") +
        (d.R.origen.duda && L.anos[i] === d.R.origen.duda.ano ? `<span class="tx">Dato dudoso: el Ministerio estima ${milesR(d.R.origen.duda.mivau.total)}</span>` : ""),
      aria: "Hogares nuevos frente a viviendas terminadas por año desde 2002" }); },
    pie: "Hogares nuevos: hasta 2020, variación anual de las viviendas principales estimada por el Ministerio de Vivienda (cada vivienda principal es un hogar); desde 2021, estadística del INE. El salto de 2011 se debe al ajuste de la estimación al censo de ese año. El dato de 2021 es dudoso: el INE da 283.000 hogares nuevos y el Ministerio, unos 125.000 (se explica más abajo)." },

  { id: "origen", corto: "Origen de los hogares", eyebrow: "Componente 1 · Cuánta gente busca casa",
    q: "Origen de los hogares nuevos",
    resp: d => { const O = d.O;
      return `Desde ${O.a1}, la mayor parte del crecimiento de hogares procede de la llegada de población desde el extranjero, que aporta de media <strong>${milesR(O.extMed)} hogares al año</strong>. La aportación de la población residente es pequeña, porque hay más defunciones que nacimientos.`; },
    expl: d => { const O = d.O, F = d.R.origen.flujos, a = d.R.origen.ult_mig, sl = d.R.origen.saldo;
      return `La inmigración incluye a cualquier persona que llega del extranjero, de cualquier país, <strong>también españoles</strong>. En ${a} llegaron ${millones(F.inmigraciones_total[a])} de personas; ${milesR(F.inmigraciones_espanoles[a])} tenían nacionalidad española y ${milesR(F.inmigraciones_nacidos_espana[a])} habían nacido en España y volvían. En el mismo año se fueron ${milesR(F.emigraciones_total[a])}, así que la población creció en ${milesR(sl.total[a])} personas por la migración. Los españoles se van y vuelven en cifras parecidas: su saldo fue de ${(sl.espanoles[a] >= 0 ? "+" : "−") + milesR(Math.abs(sl.espanoles[a]))}.`; },
    lectura: d => { const R = d.R.origen, L = d.R.largo;
      const per = (a0, a1, k) => { const v = R.anos.map((a, i) => a >= a0 && a <= a1 ? R[k][i] : null).filter(x => x != null); return v.length ? suma(v) / v.length : null; };
      const i21 = R.anos.indexOf(2021), ia = a => R.anos.indexOf(a);
      const iMin = L.mig_extranjeros.indexOf(Math.min(...L.mig_extranjeros)), iMax = L.mig_extranjeros.indexOf(Math.max(...L.mig_extranjeros));
      const eMin = Math.min(...L.mig_espanoles), aEMin = L.mig_anos[L.mig_espanoles.indexOf(eMin)];
      const etapa = (t, x) => `<article><h4>${t}</h4><p>${x}</p></article>`;
      const tm = a => nf1.format(R.tam_medio[ia(a)]);
      return `${avisoDuda(d)}<section class="lectura" aria-labelledby="peq-t">
        <h3 id="peq-t">Qué son los «hogares más pequeños»</h3>
        <div class="lect-grid">
          <article class="ancho"><p>Es la parte de los hogares nuevos que aparece <strong>sin que llegue nadie</strong>: la misma gente se reparte en más viviendas porque en cada una vive menos gente.</p></article>
          <article><h4>Un ejemplo</h4><p>Una familia de 4 vive en un piso: 1 hogar. El hijo se independiza y se va a vivir solo: 2 hogares. Los padres se separan: 3 hogares. Siguen siendo 4 personas, pero ahora necesitan 3 viviendas.</p></article>
          <article><h4>Por qué pasa</h4><p>Jóvenes que se independizan, parejas que se separan, personas mayores que se quedan solas al enviudar, familias con menos hijos y más gente que elige vivir sola.</p></article>
          <article><h4>Cómo se mide</h4><p>Con el tamaño medio del hogar: ${tm(2002)} personas en 2002, ${tm(2008)} en 2008, ${tm(2015)} en 2015 y ${nf1.format(ult(R.tam_medio))} en ${ult(R.anos)}. Cuando baja, hacen falta más viviendas para la misma población. Cuando sube, como entre 2017 y 2019, la barra sale negativa: más gente compartiendo vivienda.</p></article>
        </div></section>
        ${ochoAnos(d)}
        <section class="lectura" aria-labelledby="tend-t">
        <h3 id="tend-t">Cómo ha cambiado desde 2002</h3>
        <div class="lect-grid">
          ${etapa("2002–2008: burbuja", `Se formaban unos ${milesR(per(2002, 2008, "total"))} hogares al año. Algo más de la mitad, por el fuerte crecimiento de la población; el resto, porque los hogares se hacían más pequeños muy deprisa (de ${nf1.format(R.tam_medio[0])} a ${nf1.format(R.tam_medio[ia(2008)])} personas). No hay saldo migratorio por nacionalidad antes de 2008.`)}
          ${etapa("2009–2014: crisis", `Los hogares nuevos caen a unos ${milesR(per(2009, 2014, "total"))} al año. Se van más extranjeros de los que llegan (saldo de −${milesR(-L.mig_extranjeros[iMin])} personas en ${L.mig_anos[iMin]}) y también emigran españoles. Lo poco que crece sale de hogares más pequeños.`)}
          ${etapa("2015–2020: recuperación lenta", `Vuelve la llegada de población, pero los hogares nuevos siguen bajos, unos ${milesR(per(2015, 2020, "total"))} al año. El tamaño medio deja de bajar e incluso sube un poco: se comparte más vivienda.`)}
          ${etapa(`${R.anos[i21]}: un salto dudoso`, `Tras un ${R.anos[i21] - 1} en el que casi no se formaron hogares, en ${R.anos[i21]} aparecen muchos más de lo que crece la población: ${milesR(R.total[i21])} según el INE y ${milesR(R.duda.mivau.total)} según el Ministerio. El efecto es real, pero su tamaño es incierto.`)}
          ${etapa(`Desde ${d.O.a1}: la inmigración`, `El saldo migratorio de extranjeros pasa a ser el motor: entre ${milesR(d.O.extMin)} y ${milesR(d.O.extMax)} hogares al año, con un máximo de ${milesR(L.mig_extranjeros[iMax])} personas en ${L.mig_anos[iMax]}. El tamaño medio se estabiliza en ${nf1.format(ult(R.tam_medio))} personas.`)}
          ${etapa(`${ult(R.anos)}: todavía sin desglose`, `Ya sabemos que se formaron ${milesR(ult(R.total))} hogares, pero el INE aún no ha publicado las migraciones de ${ult(R.anos)}. La barra gris es el crecimiento de la población sin separar por nacionalidad.`)}
        </div></section>`; },
    det: d => `<p><strong>Cómo se calcula:</strong> el número de hogares es igual a la población dividida por el tamaño medio del hogar. Así, cada año los hogares nuevos se reparten exactamente en dos partes: los que se deben a <strong>más población</strong> y los que se deben a <strong>hogares más pequeños</strong>. La parte de más población se divide según de dónde sale ese crecimiento: saldo migratorio de extranjeros, saldo migratorio de españoles y el resto.</p>
      <p><strong>Fuentes:</strong> de 2002 a 2020, hogares según la estimación de viviendas principales del Ministerio de Vivienda y población residente del INE; desde 2021, hogares y población en viviendas familiares del INE. Saldo migratorio por nacionalidad del INE: de 2008 a 2020 con el método anterior y desde 2021 con el actual. Antes de 2008 no existe, por eso esos años aparecen en gris.</p>
      <p><strong>Qué no dice:</strong> es una aproximación que da a cada persona nueva el tamaño medio de hogar. Quienes acaban de llegar suelen vivir en hogares más numerosos, así que la parte de la inmigración puede estar algo sobrestimada. La parte "nacimientos menos defunciones y otros" incluye también los ajustes entre estadísticas distintas, que pesan sobre todo entre 2008 y 2011. En 2011 la estimación del Ministerio se ajusta al censo y crea un salto artificial. Entre 2017 y 2019 la barra de "hogares más pequeños" sale negativa porque el tamaño medio subió un poco.</p>`,
    chart: (d, el) => { const R = d.R.origen, L = d.R.largo;
      el.innerHTML = `<div class="pila-graf"><div><h4>Hogares nuevos por origen, ${R.anos[0]}–${ult(R.anos)}</h4><div class="chart" id="c-ori"></div></div><div><h4>Saldo migratorio por nacionalidad, ${L.mig_anos[0]}–${ult(L.mig_anos)} (personas)</h4><div class="chart" id="c-mig"></div></div></div>`;
      const i08 = R.anos.indexOf(2008), i11 = R.anos.indexOf(2011), i21 = R.fuente.indexOf("ine");
      grafico($("c-ori"), { tipo: "barras", modo: "pila", alto: 330, x: R.anos,
        series: [
          { n: "Saldo migratorio de extranjeros", v: R.extranjeros, c: C1 },
          { n: "Saldo migratorio de españoles", v: R.espanoles, c: C2 },
          { n: "Hogares más pequeños", v: R.tamano, c: C3 },
          { n: "Nacimientos menos defunciones y otros", v: R.natural, c: C4 },
          { n: "Más población, sin desglose por nacionalidad", v: R.poblacion_sin_desglose, c: "var(--muted)" }],
        lineas: [{ n: "Hogares nuevos (total)", v: R.total, c: "var(--ink)" }],
        bandas: [{ i0: 0, i1: R.anos.indexOf(2008), t: "Burbuja (2002–2008)" }],
        marcas: [{ i: i08, t: "Desde aquí, migración por nacionalidad", fila: 1 }, { i: i11, t: "Ajuste al censo", fila: 2 }, { i: i21, t: "Desde aquí, datos del INE · 2021 dudoso", fila: 1 }],
        y: { fmt: v => v === 0 ? "0" : (v < 0 ? "−" : "") + nf0.format(Math.abs(v) / 1000) + " mil" }, ml: 58,
        tipFmt: v => (v < 0 ? "−" : "") + nf0.format(Math.abs(v)),
        tipExtra: i => `<span class="tx">${R.fuente[i] === "ine" ? "Hogares: INE" : "Hogares: estimación del Ministerio"} · ${nf1.format(R.tam_medio[i])} personas por hogar</span>` +
          (R.duda && R.anos[i] === R.duda.ano ? `<span class="tx">Dato dudoso: el Ministerio estima ${milesR(R.duda.mivau.total)} hogares nuevos</span>` : ""),
        aria: "Hogares nuevos por año según su origen desde 2002" });
      grafico($("c-mig"), { tipo: "barras", modo: "pila", alto: 260, x: L.mig_anos,
        series: [{ n: "Extranjeros", v: L.mig_extranjeros, c: C1 }, { n: "Españoles", v: L.mig_espanoles, c: C2 }],
        marcas: [{ i: L.mig_anos.indexOf(L.mig_cambio), t: "Cambio de método" }],
        y: { fmt: v => v === 0 ? "0" : (v < 0 ? "−" : "") + nf0.format(Math.abs(v) / 1000) + " mil" }, ml: 58,
        tipFmt: v => (v < 0 ? "−" : "") + nf0.format(Math.abs(v)), aria: "Saldo migratorio con el extranjero por nacionalidad desde 2008" }); },
    pie: "Arriba: la línea negra es el total de hogares nuevos, lo que suman las barras por encima de cero menos lo que restan las de debajo; cada parte está convertida en hogares con el tamaño medio del hogar de ese año. Abajo: llegadas menos salidas al extranjero, en personas. Antes de 2008 no hay saldo migratorio oficial por nacionalidad, y desde 2021 el INE usa un método nuevo, no exactamente comparable con el anterior." },

  { id: "construccion", corto: "Construcción y costes", eyebrow: "Componente 2 · Cuántas viviendas se hacen y qué cuesta hacerlas",
    lectura: d => obraHTML(d) + normasHTML(),
    q: "Evolución de la construcción de viviendas",
    resp: d => `La construcción sigue por debajo de los niveles anteriores a 2008. En ${d.C.anos[d.iPico]} se terminaron <strong>${milesR(d.tot[d.iPico])}</strong> viviendas; en ${d.C.anos[d.iMin]}, <strong>${milesR(d.tot[d.iMin])}</strong>; en ${ult(d.C.anos)}, <strong>${milesR(ult(d.tot))}</strong>.`,
    expl: d => `Una vivienda que se empieza hoy se termina dentro de dos o tres años. Las obras que se inician sí están subiendo: ${milesR(d.ultIni)} en ${ult(d.C.anos)}${d.desdeIni ? `, la cifra más alta desde ${d.desdeIni}` : ""}, y ${milesR(d.C.ytd_ini)} ${hastaMes(d.C.ult_mes)} (${signoE(varPct(d.C.ytd_ini_prev, d.C.ytd_ini))} que un año antes). Aun así, siguen por debajo de los hogares que se forman cada año.`,
    det: d => `<p><strong>Terminadas libres:</strong> certificados de fin de obra de los Colegios de Aparejadores. <strong>Protegidas:</strong> calificaciones definitivas de los planes estatales y autonómicos, que llegan con cierto retraso respecto a la obra. <strong>Iniciadas libres:</strong> certificados de inicio de obra. Fuente: Ministerio de Vivienda. Datos mensuales disponibles hasta ${MES_CORTO[+d.C.ult_mes.slice(5, 7) - 1]} de ${d.C.ult_mes.slice(0, 4)}.</p>
      <p><strong>Qué no dice:</strong> no recoge rehabilitaciones ni cambios de uso (por ejemplo, locales convertidos en viviendas).</p>`,
    chart: (d, el) => grafico(el, { tipo: "barras", modo: "pila", alto: 290, x: d.C.anos,
      series: [{ n: "Libres terminadas", v: d.C.libres, c: C1 }, { n: "Protegidas", v: d.C.protegidas, c: C3 }],
      lineas: [{ n: "Libres iniciadas", v: d.C.iniciadas, c: C2 }],
      y: { fmt: v => v === 0 ? "0" : nf0.format(v / 1000) + " mil" }, ml: 54, tipFmt: v => nf0.format(v),
      aria: "Viviendas terminadas e iniciadas por año desde 1991" }) },

  { id: "costes", precios: true, corto: "Coste de construir", eyebrow: "Componente 2 · Qué cuesta construir",
    q: "Empleo y suelo en la construcción",
    resp: d => `En la construcción trabajan <strong>${millones(ult(d.K.ocupados) * 1000)} de personas</strong>, frente a ${millones(d.K.ocupados[d.ik(2008)] * 1000)} en 2008.`,
    expl: d => `El sector perdió más de la mitad del empleo entre 2008 y ${d.aMin}, cuando tocó fondo con ${milesR(d.oMin * 1000)} trabajadores, y desde entonces ha recuperado una parte. ${textoSuelo(d)}`,
    det: d => `<p><strong>Trabajadores:</strong> ocupados en la construcción según la Encuesta de Población Activa (INE), media anual. Incluye obra civil y reformas, no solo vivienda nueva. ${ult(d.K.anos)}: media de ${d.K.ocup_parcial} trimestres. La serie con la clasificación de sectores actual empieza en 2008; los años anteriores usan otra clasificación y no son comparables.</p>
      <p><strong>Suelo:</strong> precio medio de las parcelas de suelo urbano vendidas (Ministerio de Vivienda). Es una media de lo que se vende cada trimestre, no un índice a calidad constante, y cambia según dónde se venda suelo.</p>
      <p><strong>Qué no dice:</strong> falta el coste de los materiales. El índice oficial de costes de construcción del Ministerio dejó de publicarse en enero de 2024, así que no lo usamos.</p>`,
    chart: (d, el) => grafico(el, { tipo: "lineas", alto: 260, x: d.K.anos.map((a, i) => i === d.K.anos.length - 1 ? a + "*" : a),
      series: [{ n: "Ocupados en la construcción", v: d.K.ocupados.map(v => v / 1000), c: C1 }],
      y: { min: 0, fmt: v => nf1.format(v).replace(/,0$/, "") + " M" }, finFmt: v => nf1.format(v) + " M",
      tipFmt: v => nf0.format(v * 1000) + " mil personas",
      notas: [{ i: d.K.anos.indexOf(d.aMin), v: d.oMin / 1000, t: `${d.aMin}: ${nf0.format(d.oMin)} mil` }],
      aria: "Ocupados en la construcción por año" }),
    pie: "Millones de personas. *Media de los trimestres publicados." },

  { id: "credito", precios: true, corto: "Crédito", eyebrow: "Componente 3 · Lo que cuesta el dinero",
    q: "Coste del crédito hipotecario",
    resp: d => { const R = interesReal(d), k = R.iMin;
      return `Los datos muestran relación con el ritmo de compras, pero no con toda la subida de fondo. Entre ${R.a0} y ${R.a1} la inflación superó al interés de las hipotecas (en ${d.Cr.anos[k]}, ${nf1.format(d.Cr.inflacion[k])}\u00a0% frente a ${nf1.format(d.Cr.interes[k])}\u00a0%), lo que abarató el crédito en términos reales. Con la subida de tipos, el interés volvió a ponerse a la altura de la inflación. Aun así, las hipotecas cayeron un ${pctE(-d.caeH)} en ${d.anoCaeH} y el precio siguió subiendo.`; },
    expl: d => `Con los tipos de nuevo a la baja, en ${d.aH} se firmaron ${milesR(d.hU)} hipotecas sobre vivienda${d.desdeH ? `, la cifra más alta desde ${d.desdeH}` : ""}. Un crédito más barato permite pagar más por la misma casa: si no hay más viviendas, una parte de ese abaratamiento acaba en el precio.`,
    det: d => `<p>Estadística de Hipotecas del INE: tipo de interés medio al inicio de las hipotecas sobre vivienda, y número de hipotecas sobre vivienda inscritas cada año. Datos disponibles hasta ${MES_CORTO[+d.Cr.ult.slice(5, 7) - 1]} de ${d.Cr.ult.slice(0, 4)}. Las inscripciones en el registro van uno o dos meses por detrás de la firma. El número de hipotecas está disponible desde 2003; el tipo de interés medio con el método actual, solo desde 2009.</p>
      <p><strong>Qué no dice:</strong> muchas compras se pagan sin hipoteca, sobre todo las de inversores y no residentes, así que el crédito explica solo una parte de la demanda.</p>`,
    chart: (d, el) => {
      el.innerHTML = `<div class="duo"><div><h4>Interés de las hipotecas sobre vivienda e inflación</h4><div class="chart" id="c-int"></div><p class="note">Cuando la inflación va por encima del interés, el crédito sale barato: el dinero que se devuelve vale menos que el que se pidió.</p></div><div><h4>Hipotecas sobre vivienda firmadas al año</h4><div class="chart" id="c-hip"></div></div></div>`;
      const minY = Math.min(0, ...d.Cr.inflacion);
      grafico($("c-int"), { tipo: "lineas", alto: 220, x: d.Cr.anos.map((a, i) => i === d.Cr.anos.length - 1 && d.Cr.int_meses < 12 ? a + "*" : a),
        series: [{ n: "Interés medio de las hipotecas", v: d.Cr.interes, c: C1 }, { n: "Inflación (IPC)", v: d.Cr.inflacion, c: C2 }],
        y: { min: Math.floor(minY / 2) * 2, ref: minY < 0 ? 0 : null, fmt: v => nf0.format(v) + "\u00a0%" },
        finFmt: v => nf1.format(v) + "\u00a0%", tipFmt: v => nf1.format(v) + "\u00a0%",
        tipExtra: i => `<span class="tx">Interés real: ${conSigno(d.Cr.interes[i] - d.Cr.inflacion[i])}</span>`,
        aria: "Tipo de interés medio de las hipotecas e inflación por año" });
      const ix = d.Cr.hipo_anos.map((a, i) => i).filter(i => d.Cr.hipo_anos[i] <= d.aH);
      grafico($("c-hip"), { tipo: "barras", alto: 200, x: ix.map(i => d.Cr.hipo_anos[i]),
        series: [{ n: "Hipotecas", v: ix.map(i => d.Cr.hipotecas[i]), c: C1 }], ml: 54,
        y: { fmt: v => v === 0 ? "0" : nf0.format(v / 1000) + " mil" }, tipFmt: v => nf0.format(v), aria: "Hipotecas sobre vivienda por año" });
    },
    pie: "*Media de los meses publicados." },

  { id: "compradores", corto: "Inversión y especulación", eyebrow: "Componente 4 · Compras de inversión y propiedad",
    q: "Inversión y especulación: compras de inversión, concentración de la propiedad y tensión del alquiler",
    resp: d => { const { C, i, U } = invCompras(), M = D.mun;
      return `En ${U}, las empresas hicieron el <strong>${pct(C.empresas[i(U)])}</strong> de las compras de vivienda y los extranjeros no residentes, el <strong>${pct(C.no_residentes[i(U)])}</strong>. En ${M.ult}, <strong>${nf0.format(M.cumplen[M.ult])} de los ${nf0.format(M.evaluables[M.ult])}</strong> municipios con datos suficientes cumplían el criterio legal de subida del alquiler para declarar una zona tensionada.`; },
    pie: "Izquierda: porcentaje de las compras de vivienda hechas por empresas (INE) y por extranjeros no residentes (Ministerio de Vivienda). Misma escala. Derecha: precio de compra (IPV) y alquiler vigente (IPVA) del INE, con el año base elegido = 100, sin descontar la inflación.",
    expl: d => { const { C, i, U, maxDe } = invCompras(), eM = maxDe("empresas");
      return `Las compras de empresas y de no residentes alcanzaron su peso máximo entre ${eM.a} y ${maxDe("no_residentes").a}, con el precio en mínimos, y después bajaron. Desde entonces el precio ha subido un ${pctE(varPct(C.precio[i(eM.a)], C.precio[i(U)]))} y su peso se ha mantenido o ha bajado. El precio de compra ha subido más que el alquiler: es una señal habitual de compras que esperan revalorización, aunque tiene otras explicaciones posibles, que se detallan más abajo.`; },
    lectura: d => definicionesHTML() + comprasHTML() + precioAlquilerHTML() + mapaMunHTML() + concentracionHTML() + parqueHTML() + propiedadHTML() + vaciasHTML() + estudiosHTML() + analisisHTML(d) + regulacionHTML(),
    det: () => `<p><strong>Compras:</strong> INE, Transmisiones de Derechos de la Propiedad (empresas); Ministerio de Vivienda, Estadística de Transacciones Inmobiliarias (no residentes); INE, Estadística de Hipotecas. <strong>Precios:</strong> INE, IPV e IPVA. <strong>Municipios:</strong> Ministerio de Vivienda, SERPAVI 2011–${D.mun.ult}; INE, Atlas de Distribución de Renta de los Hogares; Catastro, titulares de inmuebles de uso residencial (${D.mun.catastro_anyo}); INE, viviendas turísticas (${D.mun.vut_periodo.replace("-", "/")}); Ministerio de Vivienda, zonas tensionadas declaradas. <strong>Propiedad del alquiler:</strong> ${D.inversion.propiedad.fuente_txt}. <strong>Viviendas vacías:</strong> INE, Censo 2021 cruzado con el consumo eléctrico.</p>
      <p><strong>Cómo se calculan los criterios:</strong> criterio b), alquiler mediano por m² de los pisos de cada municipio frente al IPC medio anual, en ventanas de cinco años (2011–2016 a ${D.mun.ult - 5}–${D.mun.ult}); solo municipios con al menos ${D.mun.min_alq} viviendas alquiladas en los dos años. Criterio a), aproximado con 12 veces el alquiler mediano de un piso dividido entre la renta neta media por hogar del mismo año.</p>
      <p><strong>Qué no dice:</strong> ninguna estadística oficial mide la especulación como tal, es decir, cuántas viviendas se compran para revenderlas con beneficio. Los datos de esta página son aproximaciones: quién compra, quién es propietario, cuánto sube el alquiler y cuántas viviendas no se usan.</p>`,
    chart: (d, el) => {
      const { C } = invCompras(), PA = D.inversion.precio_alquiler;
      el.innerHTML = `<div class="duo"><div><h4>Compras de empresas y de no residentes, % del total</h4><div class="chart" id="c-inv"></div></div><div><h4>Precio de compra y de alquiler, <span id="pa-b">${paBase}</span> = 100</h4>
        <div class="seg seg-mini" role="group" aria-label="Año base" id="pa-bases">${PA_BASES.map(a => `<button type="button" data-b="${a}" aria-pressed="${a === paBase}">Base ${a}</button>`).join("")}</div>
        <div class="chart" id="c-pa"></div></div></div>`;
      grafico($("c-inv"), { tipo: "lineas", alto: 260, x: C.anos, series: [{ n: "Empresas", v: C.empresas, c: C1 }, { n: "No residentes", v: C.no_residentes, c: C2 }],
        y: { min: 0, max: 25, ticks: [0, 5, 10, 15, 20, 25], fmt: v => v + " %" }, tipFmt: v => pct(v), aria: "Porcentaje de compras de vivienda hechas por empresas y por no residentes, por año" });
      const dibujaPA = () => { const S = paSerie(paBase);
        grafico($("c-pa"), { tipo: "lineas", alto: 224, x: S.anos, series: [{ n: "Compra", v: S.compra, c: C1 }, { n: "Alquiler vigente", v: S.alquiler, c: C3 }],
          y: { ref: 100, fmt: v => nf0.format(v) }, tipFmt: v => `${nf1.format(v)} (${signoE(v - 100)} desde ${paBase})`, aria: `Índices de precio de compra y de alquiler, ${paBase} = 100` }); };
      dibujaPA();
      $("pa-bases").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return;
        paBase = +b.dataset.b; $("pa-b").textContent = paBase;
        for (const x of $("pa-bases").children) x.setAttribute("aria-pressed", +x.dataset.b === paBase);
        dibujaPA(); const tx = $("pa-txt"); if (tx) tx.innerHTML = paTexto(paBase); });
    } },

  { id: "regulacion", corto: "Regulación del alquiler", eyebrow: "Componente 5 · Regulación del precio del alquiler",
    q: "Regulación del precio del alquiler: dónde se ha aplicado y qué muestran los datos",
    resp: d => { const { mar, U } = rgDatos();
      return `En Cataluña el precio del alquiler se ha limitado con dos leyes distintas: la catalana 11/2020, de 2020 a 2022, anulada por el Tribunal Constitucional, y la estatal 12/2023, aplicada desde marzo de 2024 en las zonas tensionadas. Desde 2025 la ley estatal también se aplica en municipios del País Vasco, Navarra, Galicia y Asturias. En los municipios declarados en marzo de 2024 la renta de los contratos nuevos varió un <strong>${signoP(mar.zt)} %</strong> desde el año anterior a los límites, frente a un <strong>${signoP(mar.no)} %</strong> en los catalanes nunca declarados; el número de contratos, un <strong>${signoP(mar.ztN)} %</strong> frente a un ${signoP(mar.noN)} %.`; },
    pie: "Izquierda: alquiler mensual medio de los contratos firmados cada trimestre en cada grupo de municipios (media de los municipios ponderada por su número de contratos). Derecha: número de contratos firmados cada trimestre, en porcentaje de la media trimestral de 2019 de ese grupo (100 = igual que en 2019). Las líneas discontinuas son la media de cada grupo en cada periodo: sin límites (hasta 2020 T3), Ley 11/2020 (2020 T4–2022 T1), sin límites (2022 T2–2024 T1) y zonas tensionadas (desde 2024 T2; los municipios declarados en octubre de 2024 entran algo más tarde). Fuente: fianzas de alquiler depositadas en el Incasòl (Generalitat de Cataluña).",
    expl: d => { const { mar, oct, l20 } = rgDatos();
      return rgVista === "2024"
        ? `Antes de los límites, la renta de los contratos nuevos subía a un ritmo parecido en todos los grupos. Desde 2024 se separan: en los municipios declarados en marzo varió un ${signoP(mar.zt)} % y en los de octubre un ${signoP(oct.zt)} %, mientras que en los nunca declarados subió un ${signoP(mar.no)} %. A la vez, se firman menos contratos: ${signoP(mar.ztN)} % en los declarados en marzo, ${signoP(mar.noN)} % en los nunca declarados. Los contratos ya venían bajando desde 2021 en todos los grupos.`
        : `Con la Ley 11/2020 en vigor, la renta de los contratos nuevos bajó un ${nf1.format(Math.abs(l20.ley2020.dur))} % en los 61 municipios regulados y ${l20.no2020.dur >= 0 ? `subió un ${nf1.format(l20.no2020.dur)} %` : `bajó un ${nf1.format(Math.abs(l20.no2020.dur))} %`} en el resto de Cataluña. Tras la anulación subió un ${nf1.format(l20.ley2020.post)} % en un año en los municipios regulados y un ${nf1.format(l20.no2020.post)} % en el resto. El periodo coincide con la pandemia, que redujo la demanda en las ciudades grandes, así que no se puede atribuir la diferencia solo a la ley.`; },
    intro: d => rgDosLeyesHTML() + rgLeyHTML() + rgHitosHTML() + rgImpactoCabHTML(),
    lectura: d => rgPeriodosHTML() + rgCantidadHTML() + rmMapaHTML() + rgAntesHTML() + rgCasosHTML() + rgEstudiosHTML(),
    det: () => `<p><strong>Fuentes:</strong> Generalitat de Cataluña, fianzas de alquiler depositadas en el Incasòl (datos abiertos, renta media y número de contratos por municipio y trimestre, ${D.regulacion.series.trim.periodos[0]} a ${ult(D.regulacion.series.trim.periodos)}); BOE (anexo de la Ley 11/2020 y sentencia 37/2022); Ministerio de Vivienda, zonas tensionadas declaradas y SERPAVI 2011–${D.mun.ult}; Tribunal Constitucional Federal alemán y banco público IBB (Berlín).</p>
      <p><strong>Cómo se calcula:</strong> para cada trimestre, media de la renta media de los municipios ponderada por su número de contratos, y suma de contratos. Grupos fijos de municipios: declarados con vigencia desde el 16 de marzo de 2024, desde el 10 de octubre de 2024 y nunca declarados; para 2020, los 61 del anexo de la Ley 11/2020 y el resto. Cuando la fuente deja en blanco la renta de un trimestre, se obtiene de los periodos acumulados que publica (por ejemplo, enero–marzo = enero–junio menos abril–junio).</p>
      <p><strong>Qué no dice:</strong> la renta media no corrige por tamaño ni calidad de la vivienda: si cambia el tipo de pisos que se alquilan, cambia la media. Los municipios declarados se eligieron por tener precios altos y subidas fuertes, así que los grupos no son iguales de partida. Los contratos de temporada y los de habitaciones no siempre depositan fianza en el Incasòl. Un contrato con renta por encima del límite también deposita fianza: el dato no mide el cumplimiento. Que bajen los contratos registrados puede deberse a menos oferta, a menos rotación de inquilinos o a contratos fuera del registro.</p>`,
    chart: (d, el) => {
      el.innerHTML = `<div class="seg seg-mini" role="group" aria-label="Medida que se compara" id="rg-vistas">${Object.entries(RG_VISTAS).map(([k, v]) => `<button type="button" data-v="${k}" aria-pressed="${k === rgVista}">${v.boton}</button>`).join("")}</div>
        <div class="duo"><div><h4>Alquiler medio de los contratos firmados cada trimestre (€/mes)</h4><div class="chart" id="c-rg-r"></div></div>
        <div><h4>Contratos firmados cada trimestre, en % de los de 2019</h4><div class="chart" id="c-rg-n"></div></div></div>`;
      rgDibujar();
      $("rg-vistas").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; rgVista = b.dataset.v; rgDibujar();
        const ex = document.querySelector("#paso-gen > p.expl"); if (ex) ex.innerHTML = PASOS.find(p => p.id === "regulacion").expl(d); });
    } },

  { id: "mapa", corto: "Por provincia", eyebrow: "Por provincia" },

  { id: "resumen", corto: "Resumen", eyebrow: "Qué dicen los datos",
    q: "Resumen de los datos",
    resp: () => `Ningún factor lo explica solo, pero no todos pesan lo mismo.`,
    lista: d => [
      ["En toda España", "Se forman muchos más hogares que viviendas", `${nf1.format(d.sH / d.sV)} hogares nuevos por cada vivienda terminada entre ${d.H.anos[0]} y ${ult(d.H.anos)}. Desde ${d.O.a1}, la mayoría se debe a la llegada de población del extranjero, que incluye a españoles que vuelven.`],
      ["En toda España", "Se construye mucho menos que antes de 2008", `${milesR(ult(d.tot))} viviendas terminadas en ${ult(d.C.anos)}, frente a ${milesR(d.tot[d.iPico])} en ${d.C.anos[d.iPico]}, y con un ${pctE(-varPct(d.K.ocupados[d.ik(2008)], ult(d.K.ocupados)))} menos de trabajadores.`],
      ["Acelera o frena", "El precio del dinero", (() => { const R = interesReal(d); return `El interés pasó del ${nf1.format(d.Cr.interes[d.iMinInt])}\u00a0% al ${nf1.format(d.Cr.interes[d.iMaxInt])}\u00a0%, pero entre ${R.a0} y ${R.a1} la inflación fue mayor, así que el crédito salió barato. Cambió el ritmo de compras, no la tendencia del precio.`; })()],
      ["Mayor en zonas concretas", "Compradores no residentes y pisos turísticos", `${pct(D.capas.no_residentes.nacional)} de las compras y ${pct(D.capas.turisticas.nacional)} de las viviendas en España, pero hasta ${pct(d.top("no_residentes").v)} de las compras en ${nombre(d.top("no_residentes").cod)}.`],
      ["Menor que tras la crisis", "Empresas compradoras", `${pct(d.eU[1])} de las compras en ${d.eU[0]}, frente al ${pct(d.eMax[1])} de ${d.eMax[0]}.`],
      ["Por municipio", "Tensión del alquiler extendida", `En ${D.mun.ult}, el ${pctE(100 * D.mun.cumplen[D.mun.ult] / D.mun.evaluables[D.mun.ult])} de los municipios con datos cumplía el criterio legal de subida del alquiler. ${D.mun.grupos.si.mas10 <= D.mun.grupos.no.mas10 ? "No es mayor" : "Es algo mayor"} donde hay más viviendas de grandes propietarios.`],
      ["Cataluña", "Regulación del precio del alquiler", (() => { const { mar } = rgDatos(); return `En los municipios catalanes declarados zona tensionada en marzo de 2024, la renta de los contratos nuevos varió un ${signoP(mar.zt)} % desde el año anterior a los límites; en los nunca declarados, un ${signoP(mar.no)} %. Se firman menos contratos en ambos grupos. Los datos no permiten separar cuánto se debe a la regulación.`; })()],
      ["Propiedad del alquiler", "Particulares con varias viviendas", (() => { const P = propAlquiler(); return `Tienen el ${pct(P.pct.varias)} de las viviendas en alquiler; las empresas privadas, el ${pct(P.pct.empresas)}, y quienes alquilan una sola vivienda, el ${pct(P.pct.uno)}.`; })()],
    ],
    det: () => `<p><strong>Lo que estos datos no miden:</strong> los plazos para conceder licencias y aprobar suelo, la normativa de cada comunidad y ayuntamiento, el coste de los materiales desde 2024, por qué están vacías las viviendas vacías y cuántas compras se hacen para revender. Todos influyen y no hay una estadística oficial actualizada que permita medirlos con el mismo detalle.</p>` },
];

function coberturaHTML() {
  const notas = {
    "Precio de compra de vivienda (INE)": "Antes de 2007 solo hay valores de tasación, que miden otra cosa.",
    "Sueldos (INE)": "Con el método actual.",
    "Hogares: estimación del Ministerio": "Años entre censos estimados; salto en 2011 por el ajuste al censo.",
    "Hogares: estadística del INE": "Serie trimestral nueva, desde el Censo de 2021.",
    "Saldo migratorio (método 2008-2021)": "Antes de 2008 no hay saldo oficial por nacionalidad.",
    "Saldo migratorio (método actual)": "2025 aún no publicado.",
    "Trabajadores de la construcción (EPA)": "Antes, otra clasificación de sectores.",
    "Interés de las hipotecas": "Antes de 2009, otra base no comparable.",
    "Compras de empresas": "Solo dato nacional.",
    "Precio del alquiler (INE)": "Solo contratos vigentes declarados a Hacienda; sin País Vasco ni Navarra.",
    "Pisos turísticos (INE)": "Estadística experimental.",
    "Tiempo para conseguir licencia": "Sin estadística oficial actualizada: la del Ministerio llega a 2019 y su web no permite la descarga automática. Solo hay estimaciones del sector.",
    "Tiempo de obra (estimado)": "Estimación a partir de viviendas iniciadas y terminadas; no mide la regulación.",
  };
  return `<section class="lectura" aria-labelledby="cob-t"><h3 id="cob-t">Desde cuándo hay datos</h3>
    <p class="note">Usamos todo lo publicado desde 2001. Donde una serie empieza más tarde es porque antes no existe o no es comparable.</p>
    <div class="tabla"><table class="num cob"><thead><tr><th scope="col">Serie</th><th scope="col">Desde</th><th scope="col">Hasta</th><th scope="col">Nota</th></tr></thead>
    <tbody>${[...D.cobertura,
      { serie: "Tiempo para conseguir licencia", desde: "—", hasta: "2019", sinDatos: true },
      { serie: "Tiempo de obra (estimado)", desde: String(RC.obra.periodos[0].desde), hasta: RC.obra.ult_mes }].map(c => `<tr${+c.desde > 2001 ? ' class="hueco"' : ""}><th scope="row">${c.serie}</th><td>${c.desde}</td><td>${c.hasta.replace("-T", " T").replace(/^(\d{4})-(\d{2})$/, (m, a, mm) => MES_CORTO[+mm - 1].slice(0, 3) + " " + a)}</td><td>${notas[c.serie] || ""}</td></tr>`).join("")}</tbody></table></div></section>`;
}

// Pasos que se muestran dentro de otro, como apartado, para acortar el recorrido.
const UNIDOS = { origen: "hogares", costes: "construccion" };
for (const [hijo, padre] of Object.entries(UNIDOS)) {
  const h = PASOS.splice(PASOS.findIndex(p => p.id === hijo), 1)[0];
  const p = PASOS.find(x => x.id === padre);
  (p.subs = p.subs || []).push(h);
}

let pasoActual = "precio";

function pintarIndicePasos() {
  $("pasos").innerHTML = PASOS.map((p, i) => `<li><a href="#vivienda-${p.id}"${p.id === pasoActual ? ' aria-current="step"' : ""}><span class="n num">${i + 1}</span>${p.corto}</a></li>`).join("");
  const a = $("pasos").querySelector('[aria-current="step"]');
  if (a) a.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function mostrarPaso(id) {
  if (UNIDOS[id]) id = UNIDOS[id];
  const i = Math.max(0, PASOS.findIndex(p => p.id === id));
  const p = PASOS[i];
  pasoActual = p.id;
  for (const c of vivos) ro.unobserve(c);
  vivos.clear();
  pintarIndicePasos();
  const d = datosPasos();
  const mapa = p.id === "mapa";
  $("paso-gen").hidden = mapa;
  $("paso-mapa").hidden = !mapa;
  if (mapa) {
    $("mapa-eyebrow").textContent = `Paso ${i + 1} de ${PASOS.length} · ${p.eyebrow}`;
    iniciarMapa();
  } else {
    let h = `<div class="pasohead"><span class="eyebrow">Paso ${i + 1} de ${PASOS.length} · ${p.eyebrow}</span>
      <h2>${p.q}${p.precios && enReal() ? '<span class="modo">Sin inflación</span>' : ""}</h2><p class="resp">${p.resp(d)}</p></div>`;
    if (p.lista) {
      h += `<ol class="concl">${p.lista(d).map(([tag, t, x]) => `<li><span class="tag">${tag}</span><div><h3>${t}</h3><p>${x}</p></div></li>`).join("")}</ol>`;
      h += `<details><summary>Lo que estos datos no miden</summary>${p.det(d)}</details>`;
      h += coberturaHTML();
      h += `<footer class="sources" id="fuentes"></footer>`;
    } else {
      if (p.intro) h += p.intro(d);
      h += `<figure class="panel chartcard"><div class="chart" id="c-paso"></div>${p.pie != null ? `<figcaption>${p.pie}</figcaption>` : ""}</figure>`;
      h += `<p class="expl">${p.expl(d)}</p>`;
      if (p.lectura) h += p.lectura(d);
      h += `<details><summary>Cómo se calcula y qué no dice</summary>${p.det(d)}</details>`;
      (p.subs || []).forEach((s, k) => {
        h += `<section class="subpaso" id="sub-${s.id}"><div class="pasohead"><h2>${s.q}${s.precios && enReal() ? '<span class="modo">Sin inflación</span>' : ""}</h2><p class="resp">${s.resp(d)}</p></div>`;
        h += `<figure class="panel chartcard"><div class="chart" id="c-sub-${k}"></div>${s.pie != null ? `<figcaption>${s.pie}</figcaption>` : ""}</figure>`;
        h += `<p class="expl">${s.expl(d)}</p>`;
        if (s.lectura) h += s.lectura(d);
        h += `<details><summary>Cómo se calcula y qué no dice</summary>${s.det(d)}</details></section>`;
      });
    }
    $("paso-gen").innerHTML = h;
    if (p.chart) p.chart(d, $("c-paso"));
    (p.subs || []).forEach((s, k) => s.chart && s.chart(d, $(`c-sub-${k}`)));
    if (p.lista) pintarFuentes();
  }
  const ant = PASOS[i - 1], sig = PASOS[i + 1];
  $("ant").hidden = !ant; $("sig").hidden = !sig;
  if (ant) $("ant").textContent = `← ${ant.corto}`;
  if (sig) $("sig").textContent = `Siguiente: ${sig.corto} →`;
  $("ppos").textContent = `${i + 1} / ${PASOS.length}`;
}
$("ant").addEventListener("click", () => { const i = PASOS.findIndex(p => p.id === pasoActual); location.hash = "vivienda-" + PASOS[i - 1].id; });
$("sig").addEventListener("click", () => { const i = PASOS.findIndex(p => p.id === pasoActual); location.hash = "vivienda-" + PASOS[i + 1].id; });
