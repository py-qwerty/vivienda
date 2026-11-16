"""Datos por municipio para el mapa de tensión e inversión del paso «Inversión y especulación».
Uso: python3 scripts/municipios.py [--sin-descarga]
  Descarga a raw/municipios/ y escribe data/municipios.json. Solo usa la biblioteca estándar.

Fuentes (todas oficiales):
  - Catastro: titulares de inmuebles de uso residencial por municipio y por número de inmuebles que tiene
    cada titular EN ESE MUNICIPIO (P_SPI_mun_V.csv).
  - INE: viviendas turísticas por municipio (tabla 39366, % sobre viviendas censadas; 39363, número).
  - INE Censo 2021: viviendas vacías por municipio (tabla 59531; solo municipios grandes).
  - Ministerio de Vivienda: zonas de mercado residencial tensionado declaradas (data/zonas_tensionadas.json, manual).
  - Ministerio de Vivienda, SERPAVI: alquiler mediano de vivienda colectiva por municipio, 2011-2024.
  - INE, Atlas de Distribución de Renta de los Hogares: renta neta media por hogar por municipio (tabla 30824).
  - INE: IPC (de data/vivienda.sqlite, generado por construir_bd.py).
  - Geometría: es-atlas 0.6.0 (líneas límite del IGN/CNIG), proyectada aquí a data/geo_municipios.json.

Criterios de zona tensionada de la Ley 12/2023 (art. 18.3), calculados para todos los municipios con datos:
  a) carga del alquiler > 30 % de la renta media de los hogares. Aproximación: 12 x alquiler mediano de un piso
     (SERPAVI) / renta neta media por hogar (ADRH), mismo año. No incluye gastos ni suministros.
  b) subida del precio en los 5 años anteriores > IPC + 3 puntos. Aquí: alquiler mediano por m² de los pisos.
"""
import math
import re
import sqlite3
import zipfile
import xml.etree.ElementTree as ET
import csv
import io
import json
import pathlib
import ssl
import sys
import time
import urllib.parse
import urllib.request

BASE = pathlib.Path(__file__).resolve().parent.parent
RAW = BASE / "raw/municipios"
CERTS = pathlib.Path(__file__).resolve().parent / "certs"
INE = "https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/{}?nult={}&tip=AM"
CATASTRO = "https://www.catastro.hacienda.gob.es/documentos/estadisticas/propietarios/{}/P_SPI_mun_V.csv"
SERPAVI_PAGINA = "https://www.mivau.gob.es/vivienda/alquila-bien-es-tu-derecho/serpavi"
ADRH_CSV = "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/30824.csv"
ES_ATLAS = "https://cdn.jsdelivr.net/npm/es-atlas@0.6.0/es/municipalities.json"
NAVEGADOR = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"


def contexto_ssl():
    """Python de python.org en macOS no trae certificados: se usan los del sistema y, para el Catastro,
    la raíz de la FNMT (SHA-256 55:41:53:B1:3D:2C:F9:DD:B7:53:BF:BE:1A:4E:0A:E0:8D:0A:A4:18:70:58:FE:60:A2:B8:62:B2:E4:B8:7B:CB)."""
    ctx = ssl.create_default_context()
    for f in ("/etc/ssl/cert.pem", CERTS / "fnmt_raiz_servidores_seguros.pem"):
        if pathlib.Path(f).exists():
            ctx.load_verify_locations(cafile=str(f))
    return ctx


CTX = contexto_ssl()


def bajar(url, destino, navegador=False, minimo=2000):
    ruta = RAW / destino
    if "--sin-descarga" in sys.argv and ruta.exists():
        return ruta.read_bytes()
    for intento in range(5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": NAVEGADOR if navegador else "vivienda-datos/0.1"})
            with urllib.request.urlopen(req, timeout=240, context=CTX) as r:
                datos = r.read()
            break
        except Exception as e:  # los servidores cortan conexiones a veces
            error = e
            time.sleep(3 * (intento + 1))
    else:
        raise error
    if len(datos) < minimo or (minimo >= 2000 and datos[:200].lstrip().lower().startswith((b"<!doctype", b"<html"))):
        raise SystemExit(f"Descarga vacía o página de error: {url}")
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_bytes(datos)
    print(f"OK {destino} ({len(datos):,} bytes)")
    return datos


def ine_municipal(tabla, nult, filtro=None):
    """Devuelve {codigo_municipio: [(anyo, periodo, valor), ...]} de una tabla del INE con municipios."""
    datos = json.loads(bajar(INE.format(tabla, nult), f"ine_{tabla}.json"))
    out = {}
    for serie in datos:
        md = serie["MetaData"]
        mun = next((m for m in md if m.get("T3_Variable") == "Municipios"), None)
        if not mun or (filtro and not filtro(md)):
            continue
        obs = [(d["Anyo"], d.get("T3_Periodo"), d["Valor"]) for d in serie["Data"] if d.get("Valor") is not None]
        if obs:
            out[mun["Codigo"]] = obs
    return out


# ---------- Catastro: concentración de la propiedad residencial ----------
def catastro(anyo):
    texto = bajar(CATASTRO.format(anyo), f"catastro_P_SPI_mun_V_{anyo}.csv").decode("latin-1")
    out = {}
    for f in csv.DictReader(io.StringIO(texto), delimiter=";"):
        n = lambda k: int(f[k] or 0)  # noqa: E731
        tot = n("INMUEBLES")
        if not tot:
            continue
        tramos = ["HASTA_1", "HASTA_5", "HASTA_10", "HASTA_25", "HASTA_100", "MAYOR_100"]
        pj = sum(n(f"I_U_PJ_{t}") for t in tramos)
        mas10 = sum(n(f"I_U_{p}_{t}") for p in ("PF", "PJ") for t in tramos[3:])  # más de 10 en el municipio
        mas100 = sum(n(f"I_U_{p}_MAYOR_100") for p in ("PF", "PJ"))
        out[f["CODINE"].zfill(5)] = {
            "res": tot,
            "pj": round(100 * pj / tot, 2),
            "mas10": round(100 * mas10 / tot, 2),
            "mas100": round(100 * mas100 / tot, 2),
            "tit100": n("U_PF_MAYOR_100") + n("U_PJ_MAYOR_100"),
        }
    return out


# ---------- SERPAVI: alquiler por municipio (xlsx de 70 MB, leído por streaming) ----------
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def _col(ref):
    n = 0
    for ch in re.match(r"[A-Z]+", ref).group():
        n = n * 26 + ord(ch) - 64
    return n - 1


def filas_xlsx(z, hoja):
    ss = []
    for _, el in ET.iterparse(z.open("xl/sharedStrings.xml")):
        if el.tag == NS + "si":
            ss.append("".join(x.text or "" for x in el.iter(NS + "t")))
            el.clear()
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
    rid = next(s.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
               for s in wb.iter(NS + "sheet") if s.get("name") == hoja)
    ruta = "xl/" + rels[rid].lstrip("/").replace("xl/", "")
    for _, el in ET.iterparse(z.open(ruta)):
        if el.tag == NS + "row":
            r = {}
            for c in el.iter(NS + "c"):
                v, tipo = c.find(NS + "v"), c.get("t")
                if tipo == "inlineStr":
                    r[_col(c.get("r"))] = "".join(x.text or "" for x in c.iter(NS + "t"))
                elif v is not None:
                    r[_col(c.get("r"))] = ss[int(v.text)] if tipo == "s" else v.text
            el.clear()
            if r:
                yield [r.get(i, "") for i in range(max(r) + 1)]


def serpavi():
    pagina = bajar(SERPAVI_PAGINA, "serpavi.html", navegador=True, minimo=500).decode("utf-8", "replace")
    enlaces = re.findall(r'href="([^"]*bd_SERPAVI[^"]*\.xlsx)"', pagina)
    if not enlaces:
        raise SystemExit("No encuentro el fichero de SERPAVI en la página del Ministerio")
    url = urllib.parse.urljoin(SERPAVI_PAGINA, enlaces[0]).replace(" ", "%20")
    bajar(url, "serpavi.xlsx", navegador=True)
    z = zipfile.ZipFile(RAW / "serpavi.xlsx")
    filas = filas_xlsx(z, "Municipios")
    cab = next(filas)
    idx = {k: i for i, k in enumerate(cab)}
    anos = sorted({int(k[-2:]) + 2000 for k in cab if re.match(r"ALQTBID12_M_VC_\d\d$", k)})
    out = {}
    num = lambda f, k: float(f[idx[k]]) if k in idx and idx[k] < len(f) and f[idx[k]] not in ("", None) else None  # noqa: E731
    for f in filas:
        cod = str(f[idx["CUMUN"]]).zfill(5)
        d = {}
        for a in anos:
            s = f"{a % 100:02d}"
            mes, m2 = num(f, f"ALQTBID12_M_VC_{s}"), num(f, f"ALQM2_LV_M_VC_{s}")
            n = (num(f, f"BI_ALVHEPCO_TVC_{s}") or 0) + (num(f, f"BI_ALVHEPCO_TVU_{s}") or 0)
            if mes or m2:
                d[a] = (mes, m2, n)
        if d:
            out[cod] = d
    return out


# ---------- INE ADRH: renta neta media por hogar por municipio ----------
def adrh():
    ruta = RAW / "adrh_30824.csv"
    if not ("--sin-descarga" in sys.argv and ruta.exists()):
        # 390 MB: se descarga por bloques al disco
        req = urllib.request.Request(ADRH_CSV, headers={"User-Agent": "vivienda-datos/0.1"})
        ruta.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(req, timeout=600, context=CTX) as r, open(ruta, "wb") as fo:
            while bloque := r.read(1 << 20):
                fo.write(bloque)
        print(f"OK adrh_30824.csv ({ruta.stat().st_size:,} bytes)")
    out = {}
    with open(ruta, encoding="utf-8-sig", newline="") as fi:
        for f in csv.reader(fi, delimiter=";"):
            if len(f) < 6 or f[1] or f[2] or f[3] != "Renta neta media por hogar":
                continue
            v = f[5].replace(".", "").replace(",", ".")
            if v and f[0][:5].isdigit():
                out.setdefault(f[0][:5], {})[int(f[4])] = float(v)
    return out


def ipc_anual():
    con = sqlite3.connect(BASE / "data/vivienda.sqlite")
    d = {}
    for p, v in con.execute("SELECT periodo, valor FROM observaciones WHERE indicador_id='ipc_indice' AND ambito='nacional'"):
        d.setdefault(int(p[:4]), []).append(v)
    return {a: sum(v) / len(v) for a, v in d.items() if len(v) == 12}


# ---------- Geometría: proyección cónica conforme y Canarias en recuadro ----------
def conica(lat1, lat2, lat0, lon0):
    r = math.radians
    f1, f2 = r(lat1), r(lat2)
    t = lambda f: math.tan(math.pi / 4 + f / 2)  # noqa: E731
    n = math.log(math.cos(f1) / math.cos(f2)) / math.log(t(f2) / t(f1))
    F = math.cos(f1) * t(f1) ** n / n
    rho0 = F / t(r(lat0)) ** n
    def p(lon, lat):
        rho = F / t(r(lat)) ** n
        th = n * r(lon - lon0)
        return rho * math.sin(th), rho0 - rho * math.cos(th)
    return p


def geometria():
    topo = json.loads(bajar(ES_ATLAS, "es-atlas-municipalities.json"))
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    pen, can = conica(37, 43, 40, -3.5), conica(27, 29.5, 28.3, -15.8)
    es_can = lambda lon, lat: lat < 30.5 and lon < -12  # noqa: E731
    # escala: la península y Baleares (con Ceuta y Melilla) ocupan 800 px de ancho
    pts = [pen(lo, la) for lo, la in [(-9.35, 43.0), (4.35, 39.9), (-3.0, 43.8), (-2.9, 35.25), (-9.3, 36.0)]]
    x0, x1 = min(p[0] for p in pts), max(p[0] for p in pts)
    y1 = max(p[1] for p in pts)
    W, M = 800, 10
    k = (W - 2 * M) / (x1 - x0)
    def Pp(lon, lat):
        x, y = pen(lon, lat)
        return (M + (x - x0) * k, M + (y1 - y) * k)
    # Canarias: recuadro abajo a la izquierda, por debajo de Cádiz y Ceuta, a escala 0,9
    S = 0.9
    cx0, cy1 = can(-18.2, 28.5)[0], can(-15.8, 29.45)[1]
    y_sur = Pp(-5.3, 35.85)[1] + 22
    def P(lon, lat):
        if es_can(lon, lat):
            x, y = can(lon, lat)
            return (M + 8 + (x - cx0) * k * S, y_sur + 8 + (cy1 - y) * k * S)
        return Pp(lon, lat)
    Q = 2  # medio píxel
    arcos = []
    for arc in topo["arcs"]:
        x = y = 0
        abs_ = []
        for dx, dy in arc:
            x += dx; y += dy
            abs_.append(P(x * sx + tx, y * sy + ty))
        q = [(round(a * Q), round(b * Q)) for a, b in abs_]
        lim = [q[0]] + [p for i, p in enumerate(q[1:-1], 1) if p != q[i - 1]] + ([q[-1]] if len(q) > 1 else [])
        # codificación delta
        d, px, py = [], 0, 0
        for a, b in lim:
            d += [a - px, b - py]; px, py = a, b
        arcos.append(d)
    obj = topo["objects"]
    muni = {g["id"]: g["arcs"] if g["type"] == "MultiPolygon" else [g["arcs"]]
            for g in obj["municipalities"]["geometries"] if not g["id"].startswith(("53", "54"))}
    prov = {g["id"]: g["arcs"] if g["type"] == "MultiPolygon" else [g["arcs"]] for g in obj["provinces"]["geometries"]}
    nombres = {g["id"]: g["properties"]["name"] for g in obj["municipalities"]["geometries"] if g["id"] in muni}
    # recuadro de Canarias
    cpts = [P(lo, la) for lo, la in [(-18.2, 27.6), (-13.4, 29.45)]]
    marco = [round(min(p[0] for p in cpts)) - 8, round(min(p[1] for p in cpts)) - 8,
             round(max(p[0] for p in cpts)) + 8, round(max(p[1] for p in cpts)) + 8]
    alto = round(max(Pp(-2.9, 35.25)[1], marco[3]) + M)
    return {"q": Q, "w": W, "h": alto, "arcos": arcos, "mun": muni, "prov": prov, "marco": marco}, nombres


MIN_ALQ = 100  # por debajo de 100 viviendas alquiladas, la mediana es poco fiable: no se calculan criterios


def criterios(alq, renta, ipc):
    """Por municipio: datos del último año y años en que se cumple cada criterio de la Ley 12/2023."""
    out, evaluables = {}, {}
    def ok(A, a):
        return a in A and A[a][2] >= MIN_ALQ
    for c in set(alq) | set(renta):
        A, R = alq.get(c, {}), renta.get(c, {})
        d, anos_a, anos_b = {}, [], []
        for a in range(2015, max(ipc) + 1):
            mes = A[a][0] if ok(A, a) else None
            if mes and R.get(a):
                if 100 * 12 * mes / R[a] > 30:
                    anos_a.append(a)
            m2 = A[a][1] if ok(A, a) else None
            m2_5 = A[a - 5][1] if ok(A, a - 5) else None
            if m2 and m2_5 and a in ipc and a - 5 in ipc:
                evaluables[a] = evaluables.get(a, 0) + 1
                if 100 * (m2 / m2_5 - ipc[a] / ipc[a - 5]) > 3:
                    anos_b.append(a)
        ua = max(A) if A else None
        if ua:
            mes, m2, n = A[ua]
            d["alq"] = round(mes) if mes else None
            d["alq_n"] = round(n)
            d["alq_a"] = ua
            if mes and R.get(ua) and ok(A, ua):
                d["esf"] = round(100 * 12 * mes / R[ua], 1)
            m2_5 = A[ua - 5][1] if ok(A, ua - 5) else None
            if m2 and m2_5 and ok(A, ua) and ua in ipc and ua - 5 in ipc:
                d["exc"] = round(100 * (m2 / m2_5 - ipc[ua] / ipc[ua - 5]), 1)
        if R:
            d["renta"] = round(R[max(R)])
        if anos_a:
            d["ca"] = anos_a
        if anos_b:
            d["cb"] = anos_b
        if d:
            out[c] = d
    return out, dict(sorted(evaluables.items()))


def main():
    anyo_cat = 2026
    cat = catastro(anyo_cat)

    vut = ine_municipal(39366, 1)
    vut_n = ine_municipal(39363, 1, lambda md: any("Número de viviendas" in m["Nombre"] for m in md))
    vac_raw = json.loads(bajar(INE.format(59531, 1), "ine_59531.json"))
    vac = {}
    for serie in vac_raw:
        md = serie["MetaData"]
        mun = next((m for m in md if m.get("T3_Variable") == "Municipios"), None)
        conc = next((m["Codigo"] for m in md if m.get("Codigo") in ("viviendastotales", "viviendasvacias")), None)
        if mun and conc and serie["Data"]:
            vac.setdefault(mun["Codigo"], {})[conc] = serie["Data"][0]["Valor"]

    zonas = json.loads((BASE / "data/zonas_tensionadas.json").read_text(encoding="utf-8"))
    ipc = ipc_anual()
    alq, renta = serpavi(), adrh()
    crit, evaluables = criterios(alq, renta, ipc)
    geo, nombres = geometria()
    (BASE / "data/geo_municipios.json").write_text(json.dumps(geo, separators=(",", ":")), encoding="utf-8")

    mun = {}
    def m(c):
        return mun.setdefault(c, {})
    for c, v in cat.items():
        m(c).update(v)
    for c, s in vut.items():
        m(c)["vut"] = s[-1][2]
    for c, s in vut_n.items():
        if c in mun:
            mun[c]["vut_n"] = s[-1][2]
    for c, v in vac.items():
        if v.get("viviendastotales"):
            m(c)["vac"] = round(100 * v.get("viviendasvacias", 0) / v["viviendastotales"], 1)
    for c, v in crit.items():
        m(c).update(v)
    for c, n in nombres.items():
        if c in mun:
            mun[c]["n"] = n
    for z in zonas["municipios"]:
        m(z["codigo_ine"])["zt"] = [z["vigencia_desde"], z["ambito"] != "municipio completo"]

    salida = {
        "catastro_anyo": anyo_cat,
        "vut_periodo": f"{max(s[-1][0] for s in vut.values())}-{max(s[-1][1] for s in vut.values())[1:]}",
        "ipc_anyos": [min(ipc), max(ipc)],
        "evaluables_b": evaluables,
        "min_alquileres": MIN_ALQ,
        "municipios": {c: v for c, v in mun.items() if c in nombres},
    }
    (BASE / "data/municipios.json").write_text(json.dumps(salida, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"data/municipios.json  ({len(mun)} municipios)")


if __name__ == "__main__":
    main()
