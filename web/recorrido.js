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
  const ley = todas.length > 1 ? leyendaHTML(todas.map(se => ({ n: se.n, c: se.c, tipo: (cfg.tipo === "lineas" || (cfg.lineas || []).includes(se)) ? "ln" : "sq" }))) : "";
  cont.innerHTML = ley + `<div class="cwrap">${s}<div class="ctip" hidden></div></div>`;
  const svg = cont.querySelector("svg"), cur = svg.querySelector(".cur"), tip = cont.querySelector(".ctip");
  const mover = e => {
    const r = svg.getBoundingClientRect(), px = e.clientX - r.left;
    const i = barras ? Math.max(0, Math.min(n - 1, Math.floor((px - m.l) / band)))
                     : Math.max(0, Math.min(n - 1, Math.round((px - m.l) / pw * (n - 1))));
    cur.setAttribute("x1", x(i)); cur.setAttribute("x2", x(i)); cur.setAttribute("visibility", "visible");
    const f = cfg.tipFmt || fy;
    tip.innerHTML = `<b>${cfg.tipX ? cfg.tipX(i) : X[i]}</b>` + todas.map(se => se.v[i] == null ? "" :
      `<span><i style="background:${se.c}"></i>${se.n}: <strong>${f(se.v[i])}</strong></span>`).join("") + (cfg.tipExtra ? cfg.tipExtra(i) : "");
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

function comprasHTML(d) {
  const p = PASOS_TODOS.compradores;
  setTimeout(() => { const el = $("c-compras"); if (el) p.chart_compras(d, el); });
  return `<section class="lectura" aria-labelledby="comp-t">
    <h3 id="comp-t">Quién compra</h3>
    <div class="lect-grid">
      <article class="ancho"><div class="chart" id="c-compras"></div></article>
      <article class="ancho"><p>${p.exp_compras(d)}</p></article>
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

  { id: "compradores", corto: "Inversión y especulación", eyebrow: "Componente 4 · Quién es propietario y quién compra",
    q: "Inversión y especulación: propiedad del alquiler, compras y regulación",
    resp: d => { const P = propAlquiler();
      return `De las viviendas alquiladas como residencia habitual, los particulares con dos o más viviendas alquiladas tienen el <strong>${pct(P.pct.varias)}</strong>; quienes alquilan una sola, el <strong>${pct(P.pct.uno)}</strong>; las empresas privadas, alrededor del <strong>${pct(P.pct.empresas)}</strong>, y el sector público, en torno al <strong>${pct(P.pct.publica)}</strong>.`; },
    pie: "Izquierda: reparto en 2023 (Ministerio de Consumo y CSIC). Derecha: viviendas alquiladas como residencia habitual declaradas por particulares en el IRPF y usadas por el Ministerio de Vivienda como referencia de precios; es una parte del total y no separa cuántas tiene cada propietario. Las marcas señalan la entrada de los territorios forales, que suma viviendas a la serie.",
    expl: d => { const S = D.inversion.propiedad.serie_particulares, i = S.anos.length - 1;
      const T = D.inversion.propiedad.serie_serpavi, tot = T.colectiva.map((v, k) => v + T.unifamiliar[k]), k1 = T.anos.indexOf(2020);
      return `Las viviendas alquiladas por particulares que recoge el Ministerio de Vivienda pasaron de ${milesR(tot[0])} en ${T.anos[0]} a ${milesR(ult(tot))} en ${ult(T.anos)}. Solo hay dos años con el reparto entre quien alquila una vivienda y quien alquila varias: entre ${S.anos[0]} y ${S.anos[i]}, las de particulares con dos o más pasaron de ${milesR(S.varias[0])} a ${milesR(S.varias[i])} (${signoE(varPct(S.varias[0], S.varias[i]))}), y las de quienes alquilan una sola, de ${milesR(S.uno[0])} a ${milesR(S.uno[i])} (${signoE(varPct(S.uno[0], S.uno[i]))}).`; },
    exp_compras: d => `Las compras de empresas llegaron al ${pct(d.eMax[1])} en ${d.eMax[0]}, cuando bancos y fondos compraron vivienda tras la crisis. Esa cifra incluye promotoras y sociedades familiares, no solo fondos. Las compras de no residentes y los pisos turísticos se concentran en ${nombre(d.top("no_residentes").cod)}, Málaga, Baleares y Canarias.`,
    lectura: d => parqueHTML() + propiedadHTML() + comprasHTML(d) + definicionesHTML() + vaciasHTML() + estudiosHTML() + regulacionHTML(),
    det: () => `<p><strong>Compras de extranjeros y de no residentes:</strong> últimos 12 meses (${periodoU4T(D.u4t)}), Ministerio de Vivienda a partir de escrituras notariales. <strong>Empresas:</strong> compraventas de vivienda en las que el comprador es una persona jurídica (INE, solo dato nacional). <strong>Pisos turísticos:</strong> viviendas anunciadas en las grandes plataformas sobre el total de viviendas del censo (INE, ${periodoMes(D.capas.turisticas.periodo)}). <strong>Propiedad del alquiler:</strong> ${D.inversion.propiedad.fuente_txt}. <strong>Viviendas vacías:</strong> INE, Censo 2021 cruzado con el consumo eléctrico.</p>
      <p><strong>Qué no dice:</strong> ninguna estadística oficial mide la especulación como tal, es decir, cuántas viviendas se compran para revenderlas con beneficio. Los datos de esta página son aproximaciones: quién compra, quién es propietario y cuántas viviendas no se usan. "Extranjero" no equivale a "inversor": los extranjeros que viven en España compran sobre todo su propia casa. Las barras de compras y la de pisos turísticos usan denominadores distintos: compras en un caso y viviendas en el otro.</p>`,
    chart: (d, el) => {
      const P = propAlquiler(), T = P.serie_serpavi;
      el.innerHTML = `<div class="duo"><div><h4>Quién es propietario de las viviendas en alquiler, ${P.anyo}</h4><div class="chart" id="c-prop"></div></div><div><h4>Viviendas alquiladas por particulares, ${T.anos[0]}–${ult(T.anos)}</h4><div class="chart" id="c-prop-t"></div></div></div>`;
      const fila = (id, c) => { const g = P.grupos.find(x => x.id === id); return { etq: g.nombre, vals: [{ v: P.pct[id], c, quien: `${milesR(g.viviendas)} viviendas` }] }; };
      barrasH($("c-prop"), [fila("uno", C1), fila("varias", C2), fila("empresas", C3), fila("publica", C4)], 50, "Porcentaje sobre el total de viviendas en alquiler de vivienda habitual. Misma escala, de 0 a 50 %.");
      grafico($("c-prop-t"), { tipo: "barras", modo: "pila", alto: 260, x: T.anos,
        series: [{ n: "Pisos", v: T.colectiva, c: C1 }, { n: "Viviendas unifamiliares", v: T.unifamiliar, c: C3 }],
        marcas: T.cobertura.map(([a, t], k) => ({ i: T.anos.indexOf(a), t, fila: k % 2 + 1 })),
        y: { fmt: v => v === 0 ? "0" : nf1.format(v / 1e6).replace(/,0$/, "") + " M" }, ml: 48, tipFmt: v => nf0.format(v),
        aria: "Viviendas alquiladas como residencia habitual por particulares, por año" });
    },
    chart_compras: (d, el) => {
      const tN = d.top("no_residentes"), tE = d.top("extranjeros"), tT = d.top("turisticas");
      barrasH(el, [
        { etq: "Compras hechas por extranjeros", vals: [{ v: D.capas.extranjeros.nacional, c: C1, quien: "España" }, { v: tE.v, c: C2, quien: nombre(tE.cod) }] },
        { etq: "Compras de extranjeros no residentes", vals: [{ v: D.capas.no_residentes.nacional, c: C1, quien: "España" }, { v: tN.v, c: C2, quien: nombre(tN.cod) }] },
        { etq: `Compras hechas por empresas (${d.eU[0]}, solo hay dato nacional)`, vals: [{ v: d.eU[1], c: C1, quien: "España" }] },
        { etq: "Viviendas anunciadas como piso turístico", vals: [{ v: D.capas.turisticas.nacional, c: C1, quien: "España" }, { v: tT.v, c: C2, quien: nombre(tT.cod) }] },
      ], 50, "Todas las barras usan la misma escala, de 0 a 50 %. En naranja, la provincia con el valor más alto.");
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

const PASOS_TODOS = Object.fromEntries(PASOS.map(p => [p.id, p]));
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
