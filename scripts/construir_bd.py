"""Lee los ficheros de raw/ y construye la base de datos data/vivienda.sqlite
más exportaciones en CSV y JSON para la web.
Uso: python scripts/construir_bd.py   (desde la carpeta vivienda-datos)"""
import csv
import datetime as dt
import json
import pathlib
import sqlite3
import sys

import pandas as pd

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from territorios import CCAA, PROVINCIAS, clasificar  # noqa: E402
import componentes  # noqa: E402

BASE = pathlib.Path(__file__).resolve().parent.parent
RAW, OUT = BASE / "raw", BASE / "data"
HOY = dt.date.today().isoformat()

FUENTES = [
    {"id": "mivau_transacciones", "organismo": "Ministerio de Vivienda y Agenda Urbana",
     "nombre": "Estadística de Transacciones Inmobiliarias. Tabla 1.6: transacciones según residencia del comprador",
     "url": "https://apps.fomento.gob.es/BoletinOnline2/?nivel=2&orden=34000000",
     "origen_datos": "Escrituras ante notario (Consejo General del Notariado)",
     "limitaciones": "Distingue nacionalidad y residencia del comprador, NO si es persona física o empresa. "
                     "El último trimestre publicado es provisional."},
    {"id": "ine_vte", "organismo": "INE",
     "nombre": "Medición del número de viviendas turísticas en España (estadística experimental)",
     "url": "https://www.ine.es/experimental/viv_turistica/experimental_viv_turistica.htm",
     "origen_datos": "Anuncios en las principales plataformas de alquiler turístico (web scraping)",
     "limitaciones": "Cuenta viviendas anunciadas, no licencias. El porcentaje se calcula sobre viviendas censadas. "
                     "Estadística experimental."},
    {"id": "ine_ipva", "organismo": "INE",
     "nombre": "Índice de Precios de Vivienda en Alquiler (IPVA), índices provinciales",
     "url": "https://www.ine.es/dyngs/INEbase/operacion.htm?c=Estadistica_C&cid=1254736177092",
     "origen_datos": "Declaraciones de IRPF (Agencia Tributaria)",
     "limitaciones": "Mide la evolución de TODOS los alquileres vigentes declarados, no solo los contratos nuevos; "
                     "por eso sube menos que los precios de los anuncios. Publicación anual con retraso de ~2 años."},
    {"id": "ine_etdp", "organismo": "INE",
     "nombre": "Estadística de Transmisiones de Derechos de la Propiedad: % de compraventas de vivienda según transmitente y titular",
     "url": "https://www.ine.es/dyngs/INEbase/operacion.htm?c=Estadistica_C&cid=1254736171438",
     "origen_datos": "Registros de la propiedad",
     "limitaciones": "Solo publicado a nivel NACIONAL. 'Persona jurídica' incluye cualquier empresa "
                     "(promotoras, sociedades familiares, bancos, fondos, SOCIMIs...), no solo fondos."},
]

FUENTES.append(
    {"id": "ine_censo_consumo", "organismo": "INE",
     "nombre": "Censo de Población y Viviendas 2021: viviendas por intensidad de uso a partir del consumo eléctrico",
     "url": "https://www.ine.es/jaxi/Tabla.htm?tpx=59531",
     "origen_datos": "Censo 2021 cruzado con el consumo eléctrico anual de cada vivienda",
     "limitaciones": "Una vivienda cuenta como vacía si su consumo eléctrico es muy bajo o nulo durante el año. "
                     "No distingue entre viviendas en venta, en obras, de herencias sin repartir, en ruina "
                     "o retenidas por su propietario. Dato de un solo momento (2021)."})

INDICADORES = [
    ("compras_total", "Compraventas de vivienda", "número", "mivau_transacciones",
     "Número total de compraventas de vivienda escrituradas."),
    ("compras_ext_residentes", "Compras de extranjeros residentes", "número", "mivau_transacciones",
     "Compraventas cuyo comprador es extranjero con residencia en España."),
    ("compras_ext_no_residentes", "Compras de extranjeros no residentes", "número", "mivau_transacciones",
     "Compraventas cuyo comprador es extranjero sin residencia en España."),
    ("pct_compras_extranjeros", "% de compras hechas por extranjeros", "%", "mivau_transacciones",
     "(Extranjeros residentes + extranjeros no residentes) / total de compraventas."),
    ("pct_compras_ext_residentes", "% de compras de extranjeros residentes", "%", "mivau_transacciones",
     "Extranjeros que viven en España: en su mayoría compran su propia vivienda."),
    ("pct_compras_ext_no_residentes", "% de compras de extranjeros no residentes", "%", "mivau_transacciones",
     "Extranjeros que no viven en España: segunda residencia o inversión."),
    ("vut_viviendas", "Viviendas turísticas anunciadas", "número", "ine_vte",
     "Viviendas ofrecidas en plataformas de alquiler turístico."),
    ("vut_pct", "% de viviendas que son turísticas", "%", "ine_vte",
     "Viviendas turísticas sobre el total de viviendas censadas."),
    ("alquiler_indice", "Índice de precio del alquiler (2015 = 100)", "índice", "ine_ipva",
     "Evolución del precio de los alquileres vigentes. 2015 = 100."),
    ("alquiler_subida_desde_2015", "Subida del alquiler desde 2015", "%", "ine_ipva",
     "Variación del IPVA entre 2015 y el último año disponible."),
    ("pct_compras_persona_juridica", "% de compras de vivienda hechas por empresas", "%", "ine_etdp",
     "Compraventas en las que el nuevo titular es una persona jurídica (cualquier tipo de empresa)."),
]

FUENTES += componentes.FUENTES
INDICADORES += componentes.INDICADORES

filas = []  # (indicador, ambito, codigo, periodo, tipo_periodo, valor)


INDICADORES += [
    ("viviendas_censo", "Viviendas (Censo 2021)", "número", "ine_censo_consumo",
     "Total de viviendas del Censo 2021."),
    ("viviendas_vacias", "Viviendas vacías (Censo 2021)", "número", "ine_censo_consumo",
     "Viviendas con consumo eléctrico muy bajo o nulo durante el año."),
    ("pct_viviendas_vacias", "% de viviendas vacías (Censo 2021)", "%", "ine_censo_consumo",
     "Viviendas vacías sobre el total de viviendas."),
]


def add(ind, territorios, periodo, tipo, valor):
    if valor is None or pd.isna(valor):
        return
    for ambito, cod in territorios:
        filas.append((ind, ambito, cod, periodo, tipo, float(valor)))


# ---------- Ministerio de Vivienda: compras por residencia/nacionalidad ----------
def cargar_mivau():
    x = pd.ExcelFile(RAW / "mivau/340101d0.xls")
    trimestral = {}  # (ambito,cod,periodo) -> dict
    for hoja in x.sheet_names:
        t, anyo = hoja.split()
        periodo = f"{anyo}-T{t[0]}"
        df = x.parse(hoja, header=None)
        fila_tot = next(i for i in range(len(df)) if str(df.iat[i, 1]).strip().upper() == "TOTAL NACIONAL")
        for i in range(fila_tot, len(df)):
            nombre = df.iat[i, 1]
            if pd.isna(nombre):
                continue
            terr = clasificar(nombre)
            if not terr:
                continue
            v = [pd.to_numeric(df.iat[i, c], errors="coerce") for c in range(3, 13)]
            d = {"total": v[0], "ext_res": v[3], "esp_nores": v[6], "ext_nores": v[7]}
            for amb, cod in terr:
                trimestral[(amb, cod, periodo)] = d
    # trimestral
    for (amb, cod, per), d in trimestral.items():
        emitir_mivau([(amb, cod)], per, "trimestre", d)
    # anual (solo años completos) y últimos 4 trimestres
    claves = sorted({(a, c) for a, c, _ in trimestral})
    periodos = sorted({p for _, _, p in trimestral})
    ultimo = periodos[-1]
    ult4 = periodos[-4:]
    for amb, cod in claves:
        anos = {}
        for per in periodos:
            if (amb, cod, per) in trimestral:
                anos.setdefault(per[:4], []).append(trimestral[(amb, cod, per)])
        for ano, lst in anos.items():
            if len(lst) == 4:
                emitir_mivau([(amb, cod)], ano, "año", sumar(lst))
        lst = [trimestral[(amb, cod, p)] for p in ult4 if (amb, cod, p) in trimestral]
        if len(lst) == 4:
            emitir_mivau([(amb, cod)], f"U4T-{ultimo}", "ultimos_12_meses", sumar(lst))
    return ult4


def sumar(lst):
    return {k: sum(d[k] for d in lst) for k in lst[0]}


def emitir_mivau(terr, per, tipo, d):
    tot = d["total"]
    add("compras_total", terr, per, tipo, tot)
    add("compras_ext_residentes", terr, per, tipo, d["ext_res"])
    add("compras_ext_no_residentes", terr, per, tipo, d["ext_nores"])
    if tot and tot > 0:
        add("pct_compras_extranjeros", terr, per, tipo, 100 * (d["ext_res"] + d["ext_nores"]) / tot)
        add("pct_compras_ext_residentes", terr, per, tipo, 100 * d["ext_res"] / tot)
        add("pct_compras_ext_no_residentes", terr, per, tipo, 100 * d["ext_nores"] / tot)


# ---------- INE (API JSON) ----------
def series_ine(fichero):
    return json.load(open(RAW / fichero, encoding="utf-8"))


def fecha_ine(dato):
    f = dato["Fecha"]
    if isinstance(f, (int, float)):  # formato antiguo de la API: milisegundos
        return (dt.datetime.fromtimestamp(f / 1000, dt.timezone.utc) + dt.timedelta(hours=12)).date()
    return dt.date.fromisoformat(f[:10])


def terr_de_serie(s):
    md = s["MetaData"][0]
    return clasificar(md["Nombre"])


def cargar_vte():
    for fich, ind in (("ine/vte_39364.json", "vut_viviendas"), ("ine/vte_39365.json", "vut_pct")):
        for s in series_ine(fich):
            nombre = s["Nombre"]
            if ind == "vut_viviendas" and "Viviendas turísticas." not in nombre:
                continue
            terr = terr_de_serie(s)
            for dato in s["Data"]:
                f = fecha_ine(dato)
                add(ind, terr, f"{f.year}-{f.month:02d}", "mes", dato["Valor"])


def cargar_ipva():
    for s in series_ine("ine/ipva_59058.json"):
        n = s["Nombre"]
        if ". Total. Índice." not in n:
            continue
        terr = terr_de_serie(s)
        datos = {d["Anyo"]: d["Valor"] for d in s["Data"] if d["Valor"] is not None}
        for ano, v in datos.items():
            add("alquiler_indice", terr, str(ano), "año", v)
        ult = max(datos)
        if 2015 in datos:
            add("alquiler_subida_desde_2015", terr, f"2015-{ult}", "variacion",
                100 * (datos[ult] / datos[2015] - 1))


def cargar_etdp():
    por_ano = {}
    for s in series_ine("ine/etdp_50272.json"):
        md = {m.get("T3_Variable"): m["Nombre"] for m in s["MetaData"]}
        if md.get("Titular de la vivienda") != "Persona jurídica":
            continue
        for d in s["Data"]:
            if d["Valor"] is not None:
                por_ano[d["Anyo"]] = por_ano.get(d["Anyo"], 0) + d["Valor"]
    for ano, v in por_ano.items():
        add("pct_compras_persona_juridica", [("nacional", "00")], str(ano), "año", v)


def cargar_censo_vacias():
    tot, vac = {}, {}
    for s in series_ine("ine/censo_consumo_59531.json"):
        md = s["MetaData"]
        cat = next((m["Nombre"] for m in md if m.get("T3_Variable") == "Consumo eléctrico"), None)
        if cat not in ("Viviendas totales", "Viviendas vacías") or not s["Data"]:
            continue
        t0 = md[0]
        if t0.get("T3_Variable") == "Provincias":
            terr = [("provincia", t0["Codigo"])]
        elif t0.get("T3_Variable") == "Total Nacional":
            terr = [("nacional", "00")]
        else:
            continue
        v = s["Data"][-1]["Valor"]
        if not terr or v is None:
            continue
        (tot if cat == "Viviendas totales" else vac)[tuple(terr)] = v
    for terr, t in tot.items():
        if terr in vac and t:
            add("viviendas_censo", list(terr), "2021", "año", t)
            add("viviendas_vacias", list(terr), "2021", "año", vac[terr])
            add("pct_viviendas_vacias", list(terr), "2021", "año", 100 * vac[terr] / t)


# ---------- Construcción ----------
def construir():
    ult4 = cargar_mivau()
    cargar_vte()
    cargar_ipva()
    cargar_etdp()
    cargar_censo_vacias()
    componentes.cargar(RAW, add)

    # quitar duplicados exactos (p. ej. Melilla aparece repetida en el INE)
    unicas = {}
    for f in filas:
        unicas[f[:5]] = f
    obs = sorted(unicas.values())

    OUT.mkdir(exist_ok=True)
    db = OUT / "vivienda.sqlite"
    if db.exists():
        db.unlink()
    con = sqlite3.connect(db)
    con.executescript((BASE / "scripts/esquema.sql").read_text(encoding="utf-8"))
    con.executemany("INSERT INTO ccaa VALUES (?,?)", sorted(CCAA.items()))
    con.executemany("INSERT INTO provincias VALUES (?,?,?)",
                    [(c, n, cc) for c, (n, cc) in sorted(PROVINCIAS.items())])
    con.executemany("INSERT INTO fuentes VALUES (?,?,?,?,?,?,?)",
                    [(f["id"], f["organismo"], f["nombre"], f["url"], f["origen_datos"],
                      f["limitaciones"], HOY) for f in FUENTES])
    con.executemany("INSERT INTO indicadores VALUES (?,?,?,?,?)",
                    [(i, n, u, fu, d) for i, n, u, fu, d in INDICADORES])
    con.executemany("INSERT INTO observaciones VALUES (?,?,?,?,?,?)", obs)
    con.commit()

    with open(OUT / "observaciones.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["indicador", "ambito", "codigo", "periodo", "tipo_periodo", "valor"])
        w.writerows(obs)

    exportar_mapa(con, ult4)
    con.close()
    print(f"Observaciones: {len(obs):,}  ->  {db}")


def exportar_mapa(con, ult4):
    """JSON compacto para el mapa: último dato de cada indicador por provincia,
    con la media nacional y el periodo, más fuentes y definiciones."""
    capas = {}
    for ind, nombre, unidad, fuente, desc in INDICADORES:
        fila = con.execute(
            "SELECT periodo FROM observaciones WHERE indicador_id=? AND ambito IN ('provincia','nacional') "
            "ORDER BY CASE tipo_periodo WHEN 'ultimos_12_meses' THEN 0 ELSE 1 END, periodo DESC LIMIT 1",
            (ind,)).fetchone()
        if not fila:
            continue
        per = fila[0]
        vals = dict(con.execute(
            "SELECT codigo, valor FROM observaciones WHERE indicador_id=? AND ambito='provincia' AND periodo=?",
            (ind, per)).fetchall())
        nac = con.execute(
            "SELECT valor FROM observaciones WHERE indicador_id=? AND ambito='nacional' AND periodo=?",
            (ind, per)).fetchone()
        capas[ind] = {"nombre": nombre, "unidad": unidad, "fuente": fuente, "descripcion": desc,
                      "periodo": per, "nacional": nac[0] if nac else None,
                      "provincias": {k: round(v, 3) for k, v in vals.items()},
                      "cobertura_provincial": len(vals)}
    serie_pj = con.execute(
        "SELECT periodo, valor FROM observaciones WHERE indicador_id='pct_compras_persona_juridica' "
        "ORDER BY periodo").fetchall()
    salida = {
        "generado": HOY,
        "provincias": {c: {"nombre": n, "ccaa": cc, "nombre_ccaa": CCAA[cc]}
                       for c, (n, cc) in PROVINCIAS.items()},
        "capas": capas,
        "series_nacionales": {"pct_compras_persona_juridica": serie_pj},
        "fuentes": {f["id"]: f for f in FUENTES},
    }
    (OUT / "mapa_provincias.json").write_text(
        json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    construir()
