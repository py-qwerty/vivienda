"""Códigos INE de comunidades autónomas y provincias, y emparejado de nombres
tal como aparecen en las distintas fuentes (INE, Ministerio de Vivienda...)."""
import re
import unicodedata

CCAA = {
    "01": "Andalucía", "02": "Aragón", "03": "Principado de Asturias",
    "04": "Illes Balears", "05": "Canarias", "06": "Cantabria",
    "07": "Castilla y León", "08": "Castilla-La Mancha", "09": "Cataluña",
    "10": "Comunitat Valenciana", "11": "Extremadura", "12": "Galicia",
    "13": "Comunidad de Madrid", "14": "Región de Murcia",
    "15": "Comunidad Foral de Navarra", "16": "País Vasco", "17": "La Rioja",
    "18": "Ceuta", "19": "Melilla",
}

# cod_prov: (nombre, cod_ccaa)
PROVINCIAS = {
    "01": ("Araba/Álava", "16"), "02": ("Albacete", "08"),
    "03": ("Alicante/Alacant", "10"), "04": ("Almería", "01"),
    "05": ("Ávila", "07"), "06": ("Badajoz", "11"),
    "07": ("Illes Balears", "04"), "08": ("Barcelona", "09"),
    "09": ("Burgos", "07"), "10": ("Cáceres", "11"), "11": ("Cádiz", "01"),
    "12": ("Castellón/Castelló", "10"), "13": ("Ciudad Real", "08"),
    "14": ("Córdoba", "01"), "15": ("A Coruña", "12"), "16": ("Cuenca", "08"),
    "17": ("Girona", "09"), "18": ("Granada", "01"), "19": ("Guadalajara", "08"),
    "20": ("Gipuzkoa", "16"), "21": ("Huelva", "01"), "22": ("Huesca", "02"),
    "23": ("Jaén", "01"), "24": ("León", "07"), "25": ("Lleida", "09"),
    "26": ("La Rioja", "17"), "27": ("Lugo", "12"), "28": ("Madrid", "13"),
    "29": ("Málaga", "01"), "30": ("Murcia", "14"), "31": ("Navarra", "15"),
    "32": ("Ourense", "12"), "33": ("Asturias", "03"), "34": ("Palencia", "07"),
    "35": ("Las Palmas", "05"), "36": ("Pontevedra", "12"),
    "37": ("Salamanca", "07"), "38": ("Santa Cruz de Tenerife", "05"),
    "39": ("Cantabria", "06"), "40": ("Segovia", "07"), "41": ("Sevilla", "01"),
    "42": ("Soria", "07"), "43": ("Tarragona", "09"), "44": ("Teruel", "02"),
    "45": ("Toledo", "08"), "46": ("Valencia/València", "10"),
    "47": ("Valladolid", "07"), "48": ("Bizkaia", "16"), "49": ("Zamora", "07"),
    "50": ("Zaragoza", "02"), "51": ("Ceuta", "18"), "52": ("Melilla", "19"),
}

_STOP = {"de", "la", "las", "el", "los", "a", "y", "comunidad", "foral",
         "region", "principado", "illes", "comunitat"}


def norm(nombre: str) -> str:
    """Normaliza un nombre: sin acentos, minúsculas, sin artículos ni signos."""
    s = unicodedata.normalize("NFKD", str(nombre))
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    toks = [t for t in s.split() if t not in _STOP]
    return " ".join(toks)


_ALIAS_PROV = {
    "01": ["araba alava", "alava", "araba"], "03": ["alicante alacant", "alicante"],
    "07": ["balears", "baleares"], "12": ["castellon castello", "castellon"],
    "15": ["coruna"], "26": ["rioja"], "35": ["palmas"],
    "38": ["santa cruz tenerife"], "46": ["valencia valencia", "valencia"],
}
_ALIAS_CCAA = {
    "07": ["castilla leon"], "08": ["castilla mancha"],
    "10": ["valenciana"], "04": ["balears", "baleares"],
}

PROV_POR_NOMBRE = {}
for cod, (nom, _) in PROVINCIAS.items():
    PROV_POR_NOMBRE[norm(nom)] = cod
    for a in _ALIAS_PROV.get(cod, []):
        PROV_POR_NOMBRE[a] = cod

CCAA_POR_NOMBRE = {}
for cod, nom in CCAA.items():
    CCAA_POR_NOMBRE[norm(nom)] = cod
    for a in _ALIAS_CCAA.get(cod, []):
        CCAA_POR_NOMBRE[a] = cod

# Comunidades con una sola provincia: el dato de la comunidad es el de la provincia
UNIPROVINCIALES = {c: p for p, (_, c) in PROVINCIAS.items()
                   if sum(1 for _, cc in PROVINCIAS.values() if cc == c) == 1}


def clasificar(nombre: str):
    """Devuelve lista de (ambito, codigo) a los que corresponde un nombre.
    Una comunidad uniprovincial devuelve también su provincia."""
    n = norm(nombre)
    if n in ("total nacional", "nacional", "espana", "total"):
        return [("nacional", "00")]
    out = []
    if n in CCAA_POR_NOMBRE:
        c = CCAA_POR_NOMBRE[n]
        out.append(("ccaa", c))
        if c in UNIPROVINCIALES:
            out.append(("provincia", UNIPROVINCIALES[c]))
        return out
    if n in PROV_POR_NOMBRE:
        p = PROV_POR_NOMBRE[n]
        out.append(("provincia", p))
        c = PROVINCIAS[p][1]
        if c in UNIPROVINCIALES:
            out.append(("ccaa", c))
    return out
