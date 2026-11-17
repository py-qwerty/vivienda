"""Series para el paso «Regulación del alquiler». Solo usa la biblioteca estándar.
Uso: python3 scripts/regulacion.py [--sin-descarga]
     (necesita raw/municipios/serpavi.xlsx, que baja municipios.py)

Escribe:
  data/regulacion_series.json     series agregadas (se incrustan en la web)
  data/regulacion_municipios.json series por municipio regulado (van en web/municipios.json)

Fuentes:
  - SERPAVI (Ministerio de Vivienda): alquiler mediano por m² de los pisos con contrato vigente, anual.
  - Generalitat de Cataluña, fianzas de alquiler depositadas en el Incasòl (dades obertes, conjunto qww9-bvhh):
    número de contratos nuevos y renta mensual media por municipio y trimestre (desde 2019; anual desde 2007).

Grupos de municipios catalanes (por código INE):
  - ley2020: los 61 del anexo de la Ley 11/2020 (topes de septiembre de 2020 a marzo de 2022)
  - zt_mar24 / zt_oct24: declarados zona tensionada con vigencia desde el 16-3-2024 / 10-10-2024
  - cat_no: nunca declarados (para la vista de 2024) / fuera del anexo de 2020 (para la vista de 2020)
Cada trimestre: media de la renta media de los municipios ponderada por el número de contratos.
"""
import json
import pathlib
import re
import sys
import urllib.request
import zipfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from municipios import CTX, filas_xlsx  # noqa: E402

BASE = pathlib.Path(__file__).resolve().parent.parent
RAW = BASE / "raw/regulacion"
INCASOL = "https://analisi.transparenciacatalunya.cat/resource/qww9-bvhh.json?$limit=200000"
CAT = ("08", "17", "25", "43")
EXCLUIDOS = CAT + ("01", "20", "48", "31")  # Cataluña, País Vasco y Navarra

# Anexo de la Ley 11/2020 (BOE-A-2020-11363), con el código INE de cada municipio
LEY2020 = {"08015", "08252", "08019", "17023", "43037", "08051", "08056", "08266", "08073", "08077", "17066", "08089",
           "17079", "08096", "08101", "08102", "25120", "08112", "08113", "08114", "08118", "08121", "08123", "08124",
           "08125", "08126", "08147", "17114", "17117", "08157", "08163", "08169", "08172", "43123", "08180", "08184",
           "08187", "43905", "17155", "08194", "08196", "08200", "08205", "17160", "08211", "08217", "08221", "08231",
           "08263", "08245", "08260", "08270", "43148", "08279", "43155", "43163", "08298", "08301", "08305", "08307",
           "08219"}
TRIM = {"gener-març": 1, "abril-juny": 2, "juliol-setembre": 3, "octubre-desembre": 4}
ACUM = {"gener-març": 1, "gener-juny": 2, "gener-setembre": 3, "gener-desembre": 4}
MIN_CONTRATOS = 20  # por trimestre, para dar la serie de un municipio


def incasol():
    ruta = RAW / "incasol_municipis.json"
    if not ("--sin-descarga" in sys.argv and ruta.exists()):
        RAW.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(INCASOL, headers={"User-Agent": "vivienda-datos/0.1"})
        with urllib.request.urlopen(req, timeout=240, context=CTX) as r:
            ruta.write_bytes(r.read())
    return json.loads(ruta.read_text(encoding="utf-8"))


def serpavi_municipal():
    z = zipfile.ZipFile(BASE / "raw/municipios/serpavi.xlsx")
    filas = filas_xlsx(z, "Municipios")
    cab = next(filas)
    idx = {k: i for i, k in enumerate(cab)}
    anos = sorted({int(k[-2:]) + 2000 for k in cab if re.match(r"ALQM2_LV_M_VC_\d\d$", k)})

    def num(f, k):
        return float(f[idx[k]]) if k in idx and idx[k] < len(f) and f[idx[k]] not in ("", None) else None

    mun = {}
    for f in filas:
        cod = str(f[idx["CUMUN"]]).zfill(5)
        mun[cod] = [(num(f, f"ALQM2_LV_M_VC_{a % 100:02d}"), num(f, f"BI_ALVHEPCO_TVC_{a % 100:02d}")) for a in anos]
    return anos, mun


def media(pares):
    """Media de las rentas ponderada por contratos (solo con renta) y total de contratos (todos)."""
    s = sum(p * n for p, n in pares if p and n)
    n = sum(n for p, n in pares if p and n)
    return (round(s / n, 2) if n else None), round(sum(n or 0 for _, n in pares))


def main():
    zonas = json.loads((BASE / "data/zonas_tensionadas.json").read_text(encoding="utf-8"))["municipios"]
    zt = {m["codigo_ine"]: m for m in zonas}
    cat_zt = {c for c, m in zt.items() if m["comunidad"] == "Cataluña"}

    # --- SERPAVI anual: Cataluña (zonas declaradas y resto) frente al resto de España
    anos, sm = serpavi_municipal()
    grupos_s = {"cat_zt": [], "cat_no": [], "resto": []}
    for cod, serie in sm.items():
        if cod[:2] in CAT:
            grupos_s["cat_zt" if cod in cat_zt else "cat_no"].append(serie)
        elif cod[:2] not in EXCLUIDOS:
            grupos_s["resto"].append(serie)
    series = {"anos": anos, "grupos": {}}
    for g, lista in grupos_s.items():
        col = [media([s[i] for s in lista]) for i in range(len(anos))]
        series["grupos"][g] = {"eur_m2": [c[0] for c in col], "contratos": [c[1] for c in col],
                               "municipios": [sum(1 for s in lista if s[i][0] and s[i][1]) for i in range(len(anos))]}
    esp = [media([s[i] for c, s in sm.items() if c[:2] not in ("01", "20", "48", "31")]) for i in range(len(anos))]

    # --- Incasòl trimestral
    todas = incasol()
    filas = [r for r in todas if r.get("periode") in TRIM]
    trims = sorted({(int(r["any"]), TRIM[r["periode"]]) for r in filas})
    pos = {t: i for i, t in enumerate(trims)}
    # periodos acumulados (enero–marzo, enero–junio…): sirven para recuperar la renta de un trimestre que la
    # fuente deja en blanco (pasa en 2026 T1 en muchos municipios) restando importes: T = acumulado - anterior
    acum = {}
    for r in todas:
        if r.get("periode") in ACUM and r.get("renda"):
            acum[(r["codi_territorial"].zfill(5), int(r["any"]), ACUM[r["periode"]])] = (float(r["renda"]), int(r["habitatges"]))
    trimestral = {(r["codi_territorial"].zfill(5), int(r["any"]), TRIM[r["periode"]]): (float(r["renda"]), int(r["habitatges"]))
                  for r in filas if r.get("renda")}
    por_mun, derivados = {}, 0
    for r in filas:
        c = r["codi_territorial"].zfill(5)
        a, q = int(r["any"]), TRIM[r["periode"]]
        s = por_mun.setdefault(c, [[None, 0] for _ in trims])
        n = int(r["habitatges"])
        v = float(r["renda"]) if r.get("renda") else None
        if v is None and n >= 6:  # con menos de 6 la fuente anonimiza
            if q == 1:  # enero–marzo = enero–junio menos abril–junio
                act, ant = acum.get((c, a, 2)), trimestral.get((c, a, 2))
            else:
                act, ant = acum.get((c, a, q)), acum.get((c, a, q - 1))
            if act and ant and act[1] - ant[1] == n:
                v = round((act[0] * act[1] - ant[0] * ant[1]) / n, 2); derivados += 1
        s[pos[(a, q)]] = [v, n]

    def grupo(cods):
        out = [media([por_mun[c][i] for c in cods if c in por_mun]) for i in range(len(trims))]
        return {"renta": [o[0] for o in out], "contratos": [o[1] for o in out], "municipios": len([c for c in cods if c in por_mun])}

    todos = set(por_mun)
    mar24 = {c for c in cat_zt if zt[c]["vigencia_desde"] == "2024-03-16"}
    oct24 = {c for c in cat_zt if zt[c]["vigencia_desde"] == "2024-10-10"}
    series["trim"] = {
        "periodos": [f"{a} T{q}" for a, q in trims],
        "grupos": {"ley2020": grupo(LEY2020), "no2020": grupo(todos - LEY2020),
                   "zt_mar24": grupo(mar24), "zt_oct24": grupo(oct24), "cat_no": grupo(todos - cat_zt),
                   "bcn": grupo({"08019"})},
    }
    (BASE / "data/regulacion_series.json").write_text(json.dumps(series, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    # --- Por municipio regulado
    regulados = cat_zt | LEY2020 | set(zt)
    mun = {}
    for c in sorted(regulados):
        m = {}
        if c in LEY2020:
            m["ley2020"] = 1
        if c in zt:
            m["zt"] = [zt[c]["vigencia_desde"], zt[c]["ambito"] != "municipio completo"]
        if c in por_mun:
            s = por_mun[c]
            m["r"] = [round(v) if v and n >= MIN_CONTRATOS else None for v, n in s]
            m["h"] = [n for _, n in s]
        if c in sm:
            m["s"] = [v if v and n and n >= 100 else None for v, n in sm[c]]
        mun[c] = m
    out = {"periodos": series["trim"]["periodos"], "anos": anos, "espana_m2": [e[0] for e in esp],
           "cat_no": series["trim"]["grupos"]["cat_no"]["renta"], "min_contratos": MIN_CONTRATOS, "mun": mun}
    (BASE / "data/regulacion_municipios.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    T = series["trim"]
    print("trimestres", T["periodos"][0], "→", T["periodos"][-1])
    for g, v in T["grupos"].items():
        print(g, v["municipios"], "renta", v["renta"][::4], "contratos", v["contratos"][::4])
    print("rentas trimestrales derivadas de periodos acumulados:", derivados)
    print("municipios regulados", len(mun), "con serie Incasòl", sum(1 for m in mun.values() if "r" in m))


if __name__ == "__main__":
    main()
