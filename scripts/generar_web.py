"""Genera web/index.html a partir de la base de datos y de web/plantilla.html.
Uso: python scripts/generar_web.py   (después de construir_bd.py)"""
import json
import pathlib
import sqlite3
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from territorios import CCAA, PROVINCIAS  # noqa: E402

BASE = pathlib.Path(__file__).resolve().parent.parent
con = sqlite3.connect(BASE / "data/vivienda.sqlite")


def ultimo_periodo(ind, preferir_u4t=False):
    q = ("SELECT periodo FROM observaciones WHERE indicador_id=? AND ambito='provincia' "
         + ("AND tipo_periodo='ultimos_12_meses' " if preferir_u4t else "")
         + "ORDER BY periodo DESC LIMIT 1")
    return con.execute(q, (ind,)).fetchone()[0]


def valores(ind, periodo):
    prov = dict(con.execute(
        "SELECT codigo, round(valor, 2) FROM observaciones WHERE indicador_id=? AND ambito='provincia' AND periodo=?",
        (ind, periodo)).fetchall())
    nac = con.execute(
        "SELECT round(valor, 2) FROM observaciones WHERE indicador_id=? AND ambito='nacional' AND periodo=?",
        (ind, periodo)).fetchone()
    return {"periodo": periodo, "nacional": nac[0] if nac else None, "prov": prov}


def serie_anual(ind, desde="2007"):
    filas = con.execute(
        "SELECT ambito, codigo, periodo, round(valor, 2) FROM observaciones "
        "WHERE indicador_id=? AND tipo_periodo='año' AND ambito IN ('provincia','nacional') AND periodo>=? "
        "ORDER BY periodo", (ind, desde)).fetchall()
    anos = sorted({f[2] for f in filas})
    out = {}
    for amb, cod, per, v in filas:
        k = "00" if amb == "nacional" else cod
        out.setdefault(k, [None] * len(anos))[anos.index(per)] = v
    return {"anos": [int(a) for a in anos], "valores": out}


u4t = ultimo_periodo("pct_compras_extranjeros", preferir_u4t=True)
datos = {
    "provincias": {c: [n, CCAA[cc]] for c, (n, cc) in PROVINCIAS.items()},
    "u4t": u4t,
    "capas": {
        "extranjeros": valores("pct_compras_extranjeros", u4t),
        "no_residentes": valores("pct_compras_ext_no_residentes", u4t),
        "residentes": valores("pct_compras_ext_residentes", u4t),
        "compras": valores("compras_total", u4t),
        "turisticas": valores("vut_pct", ultimo_periodo("vut_pct")),
        "turisticas_n": valores("vut_viviendas", ultimo_periodo("vut_viviendas")),
        "alquiler": valores("alquiler_subida_desde_2015", ultimo_periodo("alquiler_subida_desde_2015")),
    },
    "series": {
        "extranjeros": serie_anual("pct_compras_extranjeros"),
        "no_residentes": serie_anual("pct_compras_ext_no_residentes"),
    },
    "empresas": con.execute(
        "SELECT CAST(periodo AS INTEGER), round(valor, 1) FROM observaciones "
        "WHERE indicador_id='pct_compras_persona_juridica' ORDER BY periodo").fetchall(),
    "fuentes": [dict(zip(["id", "organismo", "nombre", "url", "origen", "limitaciones", "descarga"], f))
                for f in con.execute("SELECT * FROM fuentes")],
}

# ---------- Recorrido: componentes del precio ----------
def serie(ind, amb="nacional", cod="00", tipo=None):
    q = ("SELECT periodo, valor FROM observaciones WHERE indicador_id=? AND ambito=? AND codigo=?"
         + (" AND tipo_periodo=?" if tipo else "") + " ORDER BY periodo")
    return con.execute(q, (ind, amb, cod) + ((tipo,) if tipo else ())).fetchall()


def media_anual(filas):
    d = {}
    for p, v in filas:
        d.setdefault(int(p[:4]), []).append(v)
    return {a: (sum(v) / len(v), len(v)) for a, v in d.items()}


def v1(ind, amb, cod, per):
    r = con.execute("SELECT valor FROM observaciones WHERE indicador_id=? AND ambito=? AND codigo=? AND periodo=?",
                    (ind, amb, cod, per)).fetchone()
    return r[0] if r else None


ipv, sal, ipc = (media_anual(serie(i)) for i in ("precio_compra_indice", "salario_mensual", "ipc_indice"))
anos_p = list(range(min(ipv), max(ipv) + 1))  # el IPV empieza en 2007; los sueldos, en 2008
base = lambda d: {a: round(100 * d[a][0] / d[2015][0], 1) for a in anos_p if a in d}  # noqa: E731
P_ipv, P_sal, P_ipc = base(ipv), base(sal), base(ipc)
ult_ipv, ult_sal, ult_ipc = serie("precio_compra_indice")[-1][0], serie("salario_mensual")[-1][0], serie("ipc_indice")[-1][0]

ter_l = dict(serie("viviendas_terminadas_libres", tipo="año"))
ter_p = dict(serie("viviendas_protegidas", tipo="año"))
ini_l = dict(serie("viviendas_iniciadas_libres", tipo="año"))
anos_c = sorted(int(a) for a in ter_l)
mes_ter = serie("viviendas_terminadas_libres", tipo="mes")
mes_ini = serie("viviendas_iniciadas_libres", tipo="mes")
ult_mes = mes_ter[-1][0]
ano_ult = ult_mes[:4]

hog = dict(serie("hogares"))
anos_h = [a for a in range(2021, 2026) if f"{a}-01-01" in hog and f"{a + 1}-01-01" in hog]

ocup = media_anual(serie("ocupados_construccion"))
suelo = media_anual(serie("suelo_precio_m2"))
interes = media_anual(serie("interes_hipotecas"))
hipo = media_anual(serie("hipotecas_viviendas"))
ult_hipo = serie("hipotecas_viviendas")[-1][0]

# Presión por provincia: hogares nuevos 2021-2025 por vivienda terminada (libre + protegida)
presion, presion_h, presion_v = {}, {}, {}
for cod in PROVINCIAS:
    h0, h1 = v1("hogares", "provincia", cod, "2021-01-01"), v1("hogares", "provincia", cod, "2026-01-01")
    t = sum((v1("viviendas_terminadas_libres", "provincia", cod, str(a)) or 0)
            + (v1("viviendas_protegidas", "provincia", cod, str(a)) or 0) for a in range(2021, 2026))
    if h0 and h1 and t:
        presion[cod], presion_h[cod], presion_v[cod] = round((h1 - h0) / t, 2), round(h1 - h0), round(t)
dh_nac = hog["2026-01-01"] - hog["2021-01-01"]
t_nac = sum(ter_l[str(a)] + ter_p.get(str(a), 0) for a in range(2021, 2026))
datos["capas"]["presion"] = {"periodo": "2021-2025", "nacional": round(dh_nac / t_nac, 2), "prov": presion}
datos["presion_detalle"] = {"h": presion_h, "v": presion_v, "h_nac": round(dh_nac), "v_nac": round(t_nac)}

# Comparaciones justas: mismos trimestres del año base que los publicados del último año
q_ipv = dict(serie("precio_compra_indice"))
q_sal = dict(serie("salario_mensual"))
m_ipc = dict(serie("ipc_indice"))
ano_f = int(ult_ipv[:4])
trims = sorted({p[-1] for p in q_ipv if p.startswith(str(ano_f))} & {p[-1] for p in q_sal if p.startswith(str(ano_f))})
meses_t = [f"{3 * (int(t) - 1) + k:02d}" for t in trims for k in (1, 2, 3)]


def media_q(d, ano):
    return sum(d[f"{ano}-T{t}"] for t in trims) / len(trims)


def media_m(ano):
    return sum(m_ipc[f"{ano}-{mm}"] for mm in meses_t) / len(meses_t)


comparar = {}
for b in (2008, 2013, 2015, 2019):
    viv = media_q(q_ipv, ano_f) / media_q(q_ipv, b)
    sl = media_q(q_sal, ano_f) / media_q(q_sal, b)
    pc = media_m(ano_f) / media_m(b)
    comparar[b] = {"vivienda": round(100 * (viv - 1), 1), "sueldos": round(100 * (sl - 1), 1),
                   "ipc": round(100 * (pc - 1), 1), "real": round(100 * (viv / pc - 1), 1),
                   "sueldos_real": round(100 * (sl / pc - 1), 1),
                   "frente_sueldo": round(100 * (viv / sl - 1), 1)}
# Inflación: media anual del IPC; el último año, solo los meses publicados frente a los mismos del año anterior
ipc_meses = {}
for p, v in m_ipc.items():
    ipc_meses.setdefault(int(p[:4]), {})[p[5:]] = v
ano_ipc = max(ipc_meses)


def inflacion(a):
    meses = sorted(ipc_meses[a]) if a != ano_ipc else sorted(ipc_meses[ano_ipc])
    return 100 * (sum(ipc_meses[a][mm] for mm in meses) / sum(ipc_meses[a - 1][mm] for mm in meses) - 1)


ipc_media = {a: sum(d.values()) / len(d) for a, d in ipc_meses.items() if len(d) == 12}
# Suelo: mismos trimestres del último año frente a 2019, en precios corrientes y descontando el IPC
q_suelo = dict(serie("suelo_precio_m2"))
ano_s = int(max(q_suelo)[:4])
tr_s = sorted(p[-1] for p in q_suelo if p.startswith(str(ano_s)))
ms_s = [f"{3 * (int(t) - 1) + k:02d}" for t in tr_s for k in (1, 2, 3)]
s_nom = sum(q_suelo[f"{ano_s}-T{t}"] for t in tr_s) / sum(q_suelo[f"2019-T{t}"] for t in tr_s)
s_ipc = sum(m_ipc[f"{ano_s}-{mm}"] for mm in ms_s) / sum(m_ipc[f"2019-{mm}"] for mm in ms_s)
alq_def = ipc_media[2024] / ipc_media[2015]
datos["inflacion"] = {"alquiler_deflactor": round(alq_def, 5), "alquiler_ipc": round(100 * (alq_def - 1), 1)}

pico = max((v, p) for p, v in q_ipv.items() if p < "2010")
suelo_q = min((v, p) for p, v in q_ipv.items() if "2008" < p < "2016")

# ---------- De dónde salen los hogares nuevos ----------
# Identidad exacta: H = P / s (P: población en viviendas familiares; s: tamaño medio del hogar)
#   H1 - H0 = (P1 - P0) / s1  +  P0 * (1/s1 - 1/s0)
#             └ por más población ┘   └ por hogares más pequeños ┘
# La parte de población se reparte según de dónde sale ese crecimiento:
# saldo migratorio de extranjeros, de españoles, y el resto (nacimientos menos defunciones y ajustes).
pob = dict(serie("poblacion_viv_familiares"))
mig_t = dict(serie("saldo_migratorio_total"))
mig_e = dict(serie("saldo_migratorio_espanoles"))
flujo = {k: dict(serie(k)) for k in ("inmigraciones_total", "inmigraciones_espanoles", "inmigraciones_nacidos_espana",
                                    "emigraciones_total", "emigraciones_espanoles")}
origen = {"anos": [], "extranjeros": [], "espanoles": [], "natural": [], "poblacion_sin_desglose": [],
          "tamano": [], "total": [], "tam_medio": [], "fuente": []}
# 2002-2020: hogares = viviendas principales estimadas por el Ministerio (dato de cada año);
# población residente total del INE a 1 de enero. 2021 en adelante: hogares y población en viviendas familiares del INE.
princ_o = {int(a): v for a, v in serie("viviendas_principales", tipo="año")}
pob_tot = dict(serie("poblacion_total"))
sal_t_ant = {int(a): v for a, v in serie("saldo_migratorio_total_ant")}
sal_e_ant = {int(a): v for a, v in serie("saldo_migratorio_espanoles_ant")}


def anadir(a, P0, P1, H0, H1, ext_esp, fuente):
    s0, s1 = P0 / H0, P1 / H1
    origen["anos"].append(a); origen["fuente"].append(fuente)
    origen["tamano"].append(round(P0 * (1 / s1 - 1 / s0)))
    origen["total"].append(round(H1 - H0))
    origen["tam_medio"].append(round(s1, 3))
    if ext_esp:
        ext, esp = ext_esp
        origen["extranjeros"].append(round(ext / s1)); origen["espanoles"].append(round(esp / s1))
        origen["natural"].append(round((P1 - P0 - ext - esp) / s1)); origen["poblacion_sin_desglose"].append(None)
    else:
        origen["extranjeros"].append(None); origen["espanoles"].append(None); origen["natural"].append(None)
        origen["poblacion_sin_desglose"].append(round((P1 - P0) / s1))


for a in range(2002, 2021):
    k0, k1 = f"{a}-01-01", f"{a + 1}-01-01"
    if a in princ_o and a - 1 in princ_o and k0 in pob_tot and k1 in pob_tot:
        ee = (sal_t_ant[a] - sal_e_ant[a], sal_e_ant[a]) if a in sal_t_ant and a in sal_e_ant else None
        anadir(a, pob_tot[k0], pob_tot[k1], princ_o[a - 1], princ_o[a], ee, "mivau")
for a in range(2021, 2030):
    k0, k1 = f"{a}-01-01", f"{a + 1}-01-01"
    if all(k in d for d in (pob, hog) for k in (k0, k1)):
        ee = (mig_t[str(a)] - mig_e[str(a)], mig_e[str(a)]) if str(a) in mig_t and str(a) in mig_e else None
        anadir(a, pob[k0], pob[k1], hog[k0], hog[k1], ee, "ine")
# 2021 con las dos fuentes: el primer año de la serie del INE frente a la estimación del Ministerio
duda = {}
a21 = origen["fuente"].index("ine") if "ine" in origen["fuente"] else None
if a21 is not None:
    ano21 = origen["anos"][a21]
    k0, k1 = f"{ano21}-01-01", f"{ano21 + 1}-01-01"
    if ano21 in princ_o and ano21 - 1 in princ_o and k0 in pob_tot and k1 in pob_tot:
        P0, P1, H0, H1 = pob_tot[k0], pob_tot[k1], princ_o[ano21 - 1], princ_o[ano21]
        s0, s1 = P0 / H0, P1 / H1
        hip = {int(a): v for a, v in ((a, v[0] * 12) for a, v in hipo.items() if v[1] == 12)}
        duda = {"ano": ano21,
                "ine": {"total": origen["total"][a21], "pob": round(pob[k1] - pob[k0]), "tam": origen["tamano"][a21]},
                "mivau": {"total": round(H1 - H0), "pob": round(P1 - P0), "tam": round(P0 * (1 / s1 - 1 / s0))},
                "hip_antes": round(hip.get(ano21 - 1, 0)), "hip": round(hip.get(ano21, 0)),
                "interes": round(interes[ano21][0], 2) if ano21 in interes else None,
                "mivau_antes": round(princ_o[ano21 - 1] - princ_o[ano21 - 2]) if ano21 - 2 in princ_o else None}
origen["duda"] = duda
origen["flujos"] = {k: {int(a): v for a, v in d.items()} for k, d in flujo.items()}
origen["saldo"] = {"total": {int(a): v for a, v in mig_t.items()}, "espanoles": {int(a): v for a, v in mig_e.items()}}
origen["ult_mig"] = max(int(a) for a in mig_t)

# ---------- Tiempo de obra estimado ----------
# Desfase (en meses) con el que las viviendas terminadas siguen a las iniciadas: se busca el retraso que mejor
# hace coincidir las dos series (medias móviles de 12 meses) en cada periodo. Es una estimación de la duración
# típica de la obra, no del tiempo de licencia.
def tiempo_obra():
    ini_m, ter_m = dict(mes_ini), dict(mes_ter)
    ps = sorted(set(ini_m) & set(ter_m))
    def media12(d):
        v = [d[x] for x in ps]
        return [sum(v[i - 11:i + 1]) / 12 if i >= 11 else None for i in range(len(v))]
    I, T = media12(ini_m), media12(ter_m)
    def corr(a, b):
        ma, mb = sum(a) / len(a), sum(b) / len(b)
        num = sum((x - ma) * (y - mb) for x, y in zip(a, b))
        den = (sum((x - ma) ** 2 for x in a) * sum((y - mb) ** 2 for y in b)) ** 0.5
        return num / den if den else 0
    ult_a = int(ps[-1][:4])
    salida = []
    for a0 in range(2010, ult_a - 5, 3):
        a1 = min(a0 + 6, ult_a)
        mejor = None
        for k in range(6, 43):
            pares = [(I[i - k], T[i]) for i, x in enumerate(ps) if f"{a0}-01" <= x <= f"{a1}-12" and i - k >= 0 and I[i - k] and T[i]]
            if len(pares) > 24:
                c = corr(*zip(*pares))
                if mejor is None or c > mejor[0]:
                    mejor = (c, k)
        if mejor:
            salida.append({"desde": a0, "hasta": a1, "meses": mejor[1], "ajuste": round(mejor[0], 3)})
    if salida and salida[-1]["hasta"] < ult_a:
        salida[-1]["hasta"] = ult_a
    return {"periodos": salida, "ult_mes": ps[-1]}


obra = tiempo_obra()

# ---------- Series largas desde 2001 ----------
princ = {int(a): v for a, v in serie("viviendas_principales", tipo="año")}
largo_anos = list(range(2002, max(int(a) for a in ter_l) + 1))
hog_largo, fuente_hog = [], []
for a in largo_anos:
    if f"{a}-01-01" in hog and f"{a + 1}-01-01" in hog:          # INE, desde 2021
        hog_largo.append(round(hog[f"{a + 1}-01-01"] - hog[f"{a}-01-01"])); fuente_hog.append("ine")
    elif a in princ and a - 1 in princ:                            # Ministerio, 2002-2020
        hog_largo.append(round(princ[a] - princ[a - 1])); fuente_hog.append("mivau")
    else:
        hog_largo.append(None); fuente_hog.append(None)
viv_largo = [round(ter_l[str(a)] + ter_p.get(str(a), 0)) if str(a) in ter_l else None for a in largo_anos]
sal_ant_t = {int(a): v for a, v in serie("saldo_migratorio_total_ant")}
sal_ant_e = {int(a): v for a, v in serie("saldo_migratorio_espanoles_ant")}
sal_t = {int(a): v for a, v in mig_t.items()}
sal_e = {int(a): v for a, v in mig_e.items()}
mig_anos = sorted(set(sal_ant_t) | set(sal_t))
mig_tot = [sal_t.get(a, sal_ant_t.get(a)) for a in mig_anos]
mig_esp = [sal_e.get(a, sal_ant_e.get(a)) for a in mig_anos]
largo = {
    "anos": largo_anos, "hogares": hog_largo, "fuente": fuente_hog, "viviendas": viv_largo,
    "mig_anos": mig_anos, "mig_extranjeros": [t - e for t, e in zip(mig_tot, mig_esp)], "mig_espanoles": mig_esp,
    "mig_cambio": min(sal_t),
}
# Cobertura: desde cuándo hay datos de cada serie
cobertura = []
for ind, nombre in [("precio_compra_indice", "Precio de compra de vivienda (INE)"), ("salario_mensual", "Sueldos (INE)"),
                    ("ipc_indice", "Inflación, IPC (INE)"), ("viviendas_principales", "Hogares: estimación del Ministerio"),
                    ("hogares", "Hogares: estadística del INE"), ("viviendas_terminadas_libres", "Viviendas terminadas"),
                    ("saldo_migratorio_total_ant", "Saldo migratorio (método 2008-2021)"), ("saldo_migratorio_total", "Saldo migratorio (método actual)"),
                    ("ocupados_construccion", "Trabajadores de la construcción (EPA)"), ("suelo_precio_m2", "Precio del suelo"),
                    ("hipotecas_viviendas", "Hipotecas sobre vivienda"), ("interes_hipotecas", "Interés de las hipotecas"),
                    ("compras_total", "Compras por nacionalidad del comprador"), ("pct_compras_persona_juridica", "Compras de empresas"),
                    ("alquiler_indice", "Precio del alquiler (INE)"), ("vut_pct", "Pisos turísticos (INE)")]:
    r = con.execute("SELECT min(periodo), max(periodo) FROM observaciones WHERE indicador_id=? AND ambito='nacional' AND tipo_periodo NOT IN ('ultimos_12_meses','variacion')", (ind,)).fetchone()
    cobertura.append({"serie": nombre, "desde": r[0][:4], "hasta": r[1][:7] if len(r[1]) >= 7 else r[1]})
datos["cobertura"] = cobertura

datos["recorrido"] = {
    "precio": {"anos": anos_p, "vivienda": [P_ipv.get(a) for a in anos_p], "sueldos": [P_sal.get(a) for a in anos_p],
               "ipc": [P_ipc.get(a) for a in anos_p], "ult": {"ipv": ult_ipv, "sal": ult_sal, "ipc": ult_ipc},
               "comparar": comparar, "trims": trims, "ano_f": ano_f,
               "crisis": {"pico": pico[1], "suelo": suelo_q[1], "caida": round(100 * (suelo_q[0] / pico[0] - 1), 1)},
               "parcial": {"ipv": ipv[max(ipv)][1], "sal": sal[max(sal)][1], "ipc": ipc[max(ipc)][1]}},
    "hogares": {"anos": anos_h,
                "hogares": [round(hog[f"{a + 1}-01-01"] - hog[f"{a}-01-01"]) for a in anos_h],
                "viviendas": [round(ter_l[str(a)] + ter_p.get(str(a), 0)) for a in anos_h],
                "ult_fecha": max(hog), "hog_ult": hog[max(hog)]},
    "origen": origen,
    "largo": largo,
    "obra": obra,
    "construccion": {"anos": anos_c, "libres": [ter_l[str(a)] for a in anos_c],
                     "protegidas": [ter_p.get(str(a)) for a in anos_c],
                     "iniciadas": [ini_l.get(str(a)) for a in anos_c],
                     "ult_mes": ult_mes,
                     "ytd_ter": sum(v for p, v in mes_ter if p.startswith(ano_ult)),
                     "ytd_ini": sum(v for p, v in mes_ini if p.startswith(ano_ult)),
                     "ytd_ter_prev": sum(v for p, v in mes_ter if p[:4] == str(int(ano_ult) - 1) and p[5:] <= ult_mes[5:]),
                     "ytd_ini_prev": sum(v for p, v in mes_ini if p[:4] == str(int(ano_ult) - 1) and p[5:] <= ult_mes[5:])},
    "costes": {"anos": sorted(ocup), "ocupados": [round(ocup[a][0]) for a in sorted(ocup)],
               "ocup_parcial": ocup[max(ocup)][1],
               "suelo_anos": sorted(suelo), "suelo": [round(suelo[a][0], 1) for a in sorted(suelo)],
               "suelo_parcial": suelo[max(suelo)][1], "suelo_ult": serie("suelo_precio_m2")[-1],
               "suelo_19": {"nominal": round(100 * (s_nom - 1), 1), "real": round(100 * (s_nom / s_ipc - 1), 1)}},
    "credito": {"anos": sorted(interes), "interes": [round(interes[a][0], 2) for a in sorted(interes)],
                "int_meses": interes[max(interes)][1],
                "inflacion": [round(inflacion(a), 1) for a in sorted(interes)],
                "hipo_anos": sorted(hipo), "hipotecas": [round(hipo[a][0] * 12) for a in sorted(hipo)],
                "hipo_meses": hipo[max(hipo)][1], "ult": ult_hipo},
}

datos["normas"] = json.loads((BASE / "data/normas.json").read_text(encoding="utf-8"))

geo = json.loads((BASE / "data/geo_provincias.json").read_text(encoding="utf-8"))
geo_min = {"frame": geo["frame"], "ccaa": geo["ccaa"], "prov": {k: v["d"] for k, v in geo["prov"].items()}}

plantilla = (BASE / "web/plantilla.html").read_text(encoding="utf-8")
html = (plantilla
        .replace("/*__DATOS__*/null", json.dumps(datos, ensure_ascii=False, separators=(",", ":")))
        .replace("/*__GEO__*/null", json.dumps(geo_min, separators=(",", ":")))
        .replace("/*__RECORRIDO__*/", (BASE / "web/recorrido.js").read_text(encoding="utf-8")))
(BASE / "web/index.html").write_text(html, encoding="utf-8")
print(f"web/index.html  ({len(html.encode()):,} bytes)  periodo compras: {u4t}")
