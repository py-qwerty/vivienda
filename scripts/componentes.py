"""Indicadores de los componentes que mueven el precio de la vivienda:
precio, sueldos, inflación, hogares, construcción, suelo, empleo en la construcción e hipotecas."""
import datetime as dt
import re
import json

import pandas as pd

from territorios import clasificar

MIVAU = "https://apps.fomento.gob.es/BoletinOnline2/sedal/{}.XLS"
INE = "https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/{}?nult={}&tip=AM"

DESCARGAS = {
    "mivau/32101000.xls": MIVAU.format("32101000"),  # vivienda libre terminada, mensual 2008-
    "mivau/32201000.xls": MIVAU.format("32201000"),  # vivienda libre terminada, anual 1991-
    "mivau/32100500.xls": MIVAU.format("32100500"),  # vivienda libre iniciada, mensual 2008-
    "mivau/32200500.xls": MIVAU.format("32200500"),  # vivienda libre iniciada, anual 1991-
    "mivau/31306000.xls": MIVAU.format("31306000"),  # vivienda protegida: calificaciones definitivas, anual
    "mivau/36400500.xls": MIVAU.format("36400500"),  # precio medio del suelo urbano, trimestral
    "ine/ipv_80270.json": INE.format(80270, 100),    # índice de precios de vivienda, trimestral
    "ine/etcl_6038.json": INE.format(6038, 100),     # coste salarial por trabajador, trimestral
    "ine/ipc_76125.json": INE.format(76125, 300),    # IPC general, mensual
    "ine/hogares_60133.json": INE.format(60133, 40),  # hogares, trimestral, provincias
    "ine/epa_65354.json": INE.format(65354, 100),    # ocupados por sector y provincia, trimestral
    "ine/hipotecas_3200.json": INE.format(3200, 300),  # hipotecas constituidas, mensual, provincias
    "ine/interes_24457.json": INE.format(24457, 300),  # tipo de interés medio de las hipotecas, mensual
    "mivau/33102000.xls": MIVAU.format("33102000"),  # parque de viviendas: principales y no principales, anual 2001-
    "ine/saldos_em_24310.json": INE.format(24310, 30),  # saldo migratorio exterior por nacionalidad, 2008-2021 (método anterior)
    "ine/pobviv_60124.json": INE.format(60124, 40),
    "ine/poblacion_56934.json": INE.format(56934, 120),  # población residente desde 2001 (1 de enero y 1 de julio)  # población en viviendas familiares, trimestral
    "ine/saldos_69758.json": INE.format(69758, 12),  # saldo migratorio exterior por nacionalidad, anual
    "ine/inmig_69688.json": INE.format(69688, 12),   # inmigraciones del extranjero por nacionalidad y lugar de nacimiento
    "ine/emig_69703.json": INE.format(69703, 12),    # emigraciones al extranjero por nacionalidad y lugar de nacimiento
}

FUENTES = [
    {"id": "mivau_construccion", "organismo": "Ministerio de Vivienda y Agenda Urbana",
     "nombre": "Vivienda libre iniciada y terminada; vivienda protegida (calificaciones definitivas)",
     "url": "https://apps.fomento.gob.es/BoletinOnline2/?nivel=2&orden=32000000",
     "origen_datos": "Certificados de fin de obra de los Colegios de Aparejadores; calificaciones de las comunidades autónomas",
     "limitaciones": "La vivienda libre se mide por certificados de fin de obra y de inicio de obra. La protegida, por calificaciones definitivas, "
                     "que llegan con retraso respecto a la obra. Los datos del último año son provisionales."},
    {"id": "mivau_suelo", "organismo": "Ministerio de Vivienda y Agenda Urbana",
     "nombre": "Estadística de precios de suelo urbano",
     "url": "https://apps.fomento.gob.es/BoletinOnline2/?nivel=2&orden=36000000",
     "origen_datos": "Compraventas de suelo urbano inscritas (Notariado y Registros)",
     "limitaciones": "Precio medio de las parcelas vendidas cada trimestre: cambia mucho según dónde se venda suelo, no es un índice de precio constante."},
    {"id": "ine_ipv", "organismo": "INE", "nombre": "Índice de Precios de Vivienda (IPV)",
     "url": "https://www.ine.es/dyngs/INEbase/operacion.htm?c=Estadistica_C&cid=1254736152838",
     "origen_datos": "Compraventas ante notario", "limitaciones": "Índice de precios de compra a calidad constante. No incluye alquiler."},
    {"id": "ine_etcl", "organismo": "INE", "nombre": "Encuesta Trimestral de Coste Laboral: coste salarial total por trabajador",
     "url": "https://www.ine.es/dyngs/INEbase/operacion.htm?c=Estadistica_C&cid=1254736045053",
     "origen_datos": "Encuesta a empresas", "limitaciones": "Sueldo bruto medio por trabajador y mes, incluidas pagas extra. Excluye agricultura y empleo doméstico."},
    {"id": "ine_ipc", "organismo": "INE", "nombre": "Índice de Precios de Consumo (IPC)",
     "url": "https://www.ine.es/dyngs/INEbase/operacion.htm?c=Estadistica_C&cid=1254736176802",
     "origen_datos": "Precios recogidos en comercios", "limitaciones": "Mide la inflación general. El IPC no incluye el precio de compra de vivienda."},
    {"id": "ine_hogares", "organismo": "INE", "nombre": "Estadística Continua de Población: hogares en viviendas familiares",
     "url": "https://www.ine.es/dyngs/INEbase/operacion.htm?c=Estadistica_C&cid=1254736177095",
     "origen_datos": "Padrón y registros administrativos",
     "limitaciones": "Serie disponible desde 2021. Cuenta hogares, no viviendas: si hay más hogares que viviendas, la gente comparte o espera para independizarse."},
    {"id": "ine_epa", "organismo": "INE", "nombre": "Encuesta de Población Activa: ocupados en la construcción",
     "url": "https://www.ine.es/dyngs/INEbase/operacion.htm?c=Estadistica_C&cid=1254736176918",
     "origen_datos": "Encuesta a hogares", "limitaciones": "Incluye toda la construcción (también obra civil y reformas), no solo vivienda nueva."},
    {"id": "ine_migraciones", "organismo": "INE",
     "nombre": "Estadística de Migraciones y Cambios de Residencia: inmigraciones, emigraciones y saldo exterior por nacionalidad",
     "url": "https://www.ine.es/dyngs/INEbase/operacion.htm?c=Estadistica_C&cid=1254736177000",
     "origen_datos": "Padrón continuo",
     "limitaciones": "Datos anuales definitivos con más de un año de retraso: el último año publicado es 2024. "
                     "Incluye a cualquier persona que llega o se va, de cualquier nacionalidad, también españoles."},
    {"id": "mivau_parque", "organismo": "Ministerio de Vivienda y Agenda Urbana",
     "nombre": "Estimación del parque de viviendas: viviendas principales y no principales",
     "url": "https://apps.fomento.gob.es/BoletinOnline2/?nivel=2&orden=33000000",
     "origen_datos": "Censos de 2001, 2011 y 2021 y estimación anual del Ministerio entre ellos",
     "limitaciones": "Estimación, no recuento. Cada vivienda principal es un hogar. Hay saltos cuando la estimación se ajusta a un censo nuevo (2011)."},
    {"id": "ine_migraciones_ant", "organismo": "INE",
     "nombre": "Estadística de Migraciones (2008-2021): saldo migratorio con el extranjero por nacionalidad",
     "url": "https://www.ine.es/dyngs/INEbase/operacion.htm?c=Estadistica_C&cid=1254736177000",
     "origen_datos": "Padrón continuo",
     "limitaciones": "Método anterior a la estadística actual; no es exactamente comparable con los datos desde 2021. Antes de 2008 no hay saldo migratorio oficial con este detalle."},
    {"id": "ine_hipotecas", "organismo": "INE", "nombre": "Estadística de Hipotecas: número y tipo de interés medio sobre viviendas",
     "url": "https://www.ine.es/dyngs/INEbase/operacion.htm?c=Estadistica_C&cid=1254736170236",
     "origen_datos": "Registros de la propiedad", "limitaciones": "Fecha de inscripción en el registro, que va uno o dos meses por detrás de la firma."},
]

INDICADORES = [
    ("precio_compra_indice", "Índice de precio de compra de vivienda", "índice", "ine_ipv", "IPV general, base 2015 = 100."),
    ("salario_mensual", "Coste salarial por trabajador y mes", "€", "ine_etcl", "Sueldo bruto medio mensual."),
    ("ipc_indice", "IPC general", "índice", "ine_ipc", "Índice general de precios de consumo."),
    ("hogares", "Hogares", "número", "ine_hogares", "Hogares en viviendas familiares."),
    ("viviendas_terminadas_libres", "Viviendas libres terminadas", "número", "mivau_construccion", "Certificados de fin de obra."),
    ("viviendas_iniciadas_libres", "Viviendas libres iniciadas", "número", "mivau_construccion", "Certificados de inicio de obra."),
    ("viviendas_protegidas", "Viviendas protegidas (calificaciones definitivas)", "número", "mivau_construccion", "Planes estatales y autonómicos."),
    ("suelo_precio_m2", "Precio medio del suelo urbano", "€/m²", "mivau_suelo", "Precio medio de las parcelas vendidas."),
    ("ocupados_construccion", "Ocupados en la construcción", "miles", "ine_epa", "Personas trabajando en la construcción."),
    ("hipotecas_viviendas", "Hipotecas sobre viviendas", "número", "ine_hipotecas", "Hipotecas constituidas sobre viviendas."),
    ("viviendas_principales", "Viviendas principales (hogares)", "número", "mivau_parque", "Viviendas usadas como residencia habitual; cada una es un hogar."),
    ("saldo_migratorio_total_ant", "Saldo migratorio exterior (método 2008-2021)", "número", "ine_migraciones_ant", "Todas las nacionalidades."),
    ("saldo_migratorio_espanoles_ant", "Saldo migratorio exterior de españoles (método 2008-2021)", "número", "ine_migraciones_ant", "Nacionalidad española."),
    ("poblacion_total", "Población residente", "número", "ine_hogares", "Población residente total, incluidas residencias y otros establecimientos colectivos."),
    ("poblacion_viv_familiares", "Población en viviendas familiares", "número", "ine_hogares", "Personas que viven en viviendas familiares."),
    ("saldo_migratorio_total", "Saldo migratorio exterior", "número", "ine_migraciones", "Llegadas menos salidas al extranjero, todas las nacionalidades."),
    ("saldo_migratorio_espanoles", "Saldo migratorio exterior de españoles", "número", "ine_migraciones", "Llegadas menos salidas de personas de nacionalidad española."),
    ("inmigraciones_total", "Llegadas desde el extranjero", "número", "ine_migraciones", "Todas las nacionalidades."),
    ("inmigraciones_espanoles", "Llegadas desde el extranjero de españoles", "número", "ine_migraciones", "Personas de nacionalidad española."),
    ("inmigraciones_nacidos_espana", "Llegadas desde el extranjero de nacidos en España", "número", "ine_migraciones", "Personas nacidas en España que vuelven."),
    ("emigraciones_total", "Salidas al extranjero", "número", "ine_migraciones", "Todas las nacionalidades."),
    ("emigraciones_espanoles", "Salidas al extranjero de españoles", "número", "ine_migraciones", "Personas de nacionalidad española."),
    ("interes_hipotecas", "Tipo de interés medio de las hipotecas sobre vivienda", "%", "ine_hipotecas", "Al inicio del préstamo."),
]

MESES = {"ene": 1, "feb": 2, "mar": 3, "abr": 4, "may": 5, "jun": 6, "jul": 7, "ago": 8,
         "sep": 9, "oct": 10, "nov": 11, "dic": 12}


def _num(v):
    v = pd.to_numeric(v, errors="coerce")
    return None if pd.isna(v) else float(v)


def _filas_territorio(df, desde):
    """Recorre filas con nombre de territorio en la columna 1."""
    for i in range(desde, len(df)):
        terr = clasificar(df.iat[i, 1]) if pd.notna(df.iat[i, 1]) else []
        if terr:
            yield i, terr


def mivau_anual(raw, fichero, ind, add):
    df = pd.read_excel(raw / fichero, header=None)
    anos = {c: int(float(df.iat[10, c])) for c in range(2, df.shape[1]) if _num(df.iat[10, c])}
    for i, terr in _filas_territorio(df, 11):
        for c, a in anos.items():
            add(ind, terr, str(a), "año", _num(df.iat[i, c]))


def mivau_mensual(raw, fichero, ind, add):
    df = pd.read_excel(raw / fichero, header=None)
    ano = df.iloc[10].ffill()
    cols = {}
    for c in range(2, df.shape[1]):
        m = str(df.iat[11, c]).strip().lower()[:3]
        if m in MESES and pd.notna(ano[c]):
            cols[c] = f"{str(ano[c])[:4]}-{MESES[m]:02d}"
    for i, terr in _filas_territorio(df, 12):
        for c, per in cols.items():
            add(ind, terr, per, "mes", _num(df.iat[i, c]))


def mivau_suelo(raw, add):
    df = pd.read_excel(raw / "mivau/36400500.xls", header=None)
    ano = df.iloc[10].ffill()
    cols = {}
    for c in range(2, df.shape[1]):
        t = str(df.iat[12, c]).strip()
        a = str(ano[c])
        if t[:1] in "1234" and a.startswith("A"):
            cols[c] = f"{re.search(r'\d{4}', a).group()}-T{t[0]}"
    for i, terr in _filas_territorio(df, 13):
        for c, per in cols.items():
            add("suelo_precio_m2", terr, per, "trimestre", _num(df.iat[i, c]))


def _ine(raw, fichero):
    b = (raw / fichero).read_bytes()
    try:
        return json.loads(b.decode("utf-8"))
    except UnicodeDecodeError:
        return json.loads(b.decode("latin-1"))


def _periodo(d):
    p = d.get("T3_Periodo") or ""
    a = d["Anyo"]
    if p.startswith("M") and p[1:].isdigit():
        return f"{a}-{int(p[1:]):02d}", "mes"
    if p.startswith("T") and p[1:].isdigit():
        return f"{a}-T{int(p[1:])}", "trimestre"
    f = d["Fecha"]
    f = (dt.datetime.fromtimestamp(f / 1000, dt.timezone.utc) + dt.timedelta(hours=12)).date() \
        if isinstance(f, (int, float)) else dt.date.fromisoformat(f[:10])
    return f.isoformat(), "fecha"


def ine_serie(raw, fichero, ind, add, debe_contener, territorio_desde_meta=True, escala=1.0):
    for s in _ine(raw, fichero):
        nombre = s["Nombre"]
        if not all(k in nombre for k in debe_contener):
            continue
        terr = []
        for m in s["MetaData"]:
            terr = clasificar(m["Nombre"])
            if terr:
                break
        if not terr:
            continue
        for d in s["Data"]:
            if d["Valor"] is not None:
                per, tipo = _periodo(d)
                add(ind, terr, per, tipo, d["Valor"] * escala)


def ine_nacional(raw, fichero, ind, nombre_inicio, add):
    """Series nacionales sin metadato territorial (por ejemplo, la estadística de migraciones)."""
    n = 0
    for s in _ine(raw, fichero):
        if s["Nombre"].startswith(nombre_inicio):
            for d in s["Data"]:
                if d["Valor"] is not None:
                    per, tipo = _periodo(d)
                    if tipo == "fecha" or (d.get("T3_Periodo") or "") in ("A", ""):
                        per, tipo = str(d["Anyo"]), "año"
                    add(ind, [("nacional", "00")], per, tipo, d["Valor"])
            n += 1
    if n != 1:
        raise SystemExit(f"{fichero}: {n} series empiezan por '{nombre_inicio}'")


def mivau_principales(raw, add):
    df = pd.read_excel(raw / "mivau/33102000.xls", header=None)
    ano = df.iloc[11].ffill()
    cols = {c: int(float(ano[c])) for c in range(2, df.shape[1]) if str(df.iat[12, c]).strip() == "Principales"}
    for i, terr in _filas_territorio(df, 13):
        for c, a in cols.items():
            add("viviendas_principales", terr, str(a), "año", _num(df.iat[i, c]))


def cargar(raw, add):
    mivau_anual(raw, "mivau/32201000.xls", "viviendas_terminadas_libres", add)
    mivau_anual(raw, "mivau/32200500.xls", "viviendas_iniciadas_libres", add)
    mivau_anual(raw, "mivau/31306000.xls", "viviendas_protegidas", add)
    mivau_mensual(raw, "mivau/32101000.xls", "viviendas_terminadas_libres", add)
    mivau_mensual(raw, "mivau/32100500.xls", "viviendas_iniciadas_libres", add)
    mivau_suelo(raw, add)
    ine_serie(raw, "ine/ipv_80270.json", "precio_compra_indice", add, [". General. Índice."])
    ine_serie(raw, "ine/etcl_6038.json", "salario_mensual", add,
              ["Ambas jornadas. Industria, construcción y servicios", "Coste salarial total"])
    ine_serie(raw, "ine/ipc_76125.json", "ipc_indice", add, ["Índice general. Índice."])
    ine_serie(raw, "ine/hogares_60133.json", "hogares", add, [". Total. Hogares en viviendas familiares. Número."])
    ine_serie(raw, "ine/epa_65354.json", "ocupados_construccion", add, ["Ocupados. Ambos sexos. Construcción. Valor absoluto."])
    ine_serie(raw, "ine/hipotecas_3200.json", "hipotecas_viviendas", add, ["Viviendas. Número de hipotecas.", "Mensual"])
    ine_serie(raw, "ine/interes_24457.json", "interes_hipotecas", add, ["Viviendas. Tipo de interés medio.", "Mensual. Total."])
    mivau_principales(raw, add)
    ine_nacional(raw, "ine/saldos_em_24310.json", "saldo_migratorio_total_ant", "Total. Saldo de migración con el extranjero. Total Nacional. Total.", add)
    ine_nacional(raw, "ine/saldos_em_24310.json", "saldo_migratorio_espanoles_ant", "Española. Saldo de migración con el extranjero. Total Nacional. Total.", add)
    ine_serie(raw, "ine/poblacion_56934.json", "poblacion_total", add, ["Total Nacional. Todas las edades. Total. Población. Número."])
    ine_serie(raw, "ine/pobviv_60124.json", "poblacion_viv_familiares", add, ["Todas las edades. Total. Población en viviendas familiares. Número."])
    ine_nacional(raw, "ine/saldos_69758.json", "saldo_migratorio_total", "Total. Total. Saldo exterior.", add)
    ine_nacional(raw, "ine/saldos_69758.json", "saldo_migratorio_espanoles", "Española. Total. Saldo exterior.", add)
    ine_nacional(raw, "ine/inmig_69688.json", "inmigraciones_total", "Total. Total. Todas las edades. Total. Dato base.", add)
    ine_nacional(raw, "ine/inmig_69688.json", "inmigraciones_espanoles", "Total. Española. Todas las edades. Total. Dato base.", add)
    ine_nacional(raw, "ine/inmig_69688.json", "inmigraciones_nacidos_espana", "España. Total. Todas las edades. Total. Dato base.", add)
    ine_nacional(raw, "ine/emig_69703.json", "emigraciones_total", "Total. Total. Todas las edades. Total. Dato base.", add)
    ine_nacional(raw, "ine/emig_69703.json", "emigraciones_espanoles", "Total. Española. Todas las edades. Total. Dato base.", add)
