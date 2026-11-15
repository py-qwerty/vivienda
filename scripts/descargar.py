"""Descarga los ficheros originales de cada fuente a raw/.
Uso: python scripts/descargar.py   (desde la carpeta vivienda-datos)"""
import pathlib
import sys
import time
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import componentes  # noqa: E402

RAIZ = pathlib.Path(__file__).resolve().parent.parent / "raw"

MIVAU = "https://apps.fomento.gob.es/BoletinOnline2/sedal/{}.XLS"
INE = "https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/{}?nult={}&tip=AM"

DESCARGAS = {
    # Ministerio de Vivienda: transacciones por residencia del comprador (trimestral, provincias)
    "mivau/340101d0.xls": MIVAU.format("340101d0"),
    # INE Viviendas turísticas: nº y % sobre viviendas censadas (provincias)
    "ine/vte_39364.json": INE.format(39364, 40),
    "ine/vte_39365.json": INE.format(39365, 40),
    # INE Índice de Precios de Vivienda en Alquiler, provincias (anual, base 2015)
    "ine/ipva_59058.json": INE.format(59058, 20),
    # INE Transmisiones de derechos de la propiedad: % compraventas según transmitente y titular (anual, nacional)
    "ine/etdp_50272.json": INE.format(50272, 40),
}
DESCARGAS.update(componentes.DESCARGAS)


def bajar(url):
    for intento in range(5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "vivienda-datos/0.1"})
            with urllib.request.urlopen(req, timeout=180) as r:
                return r.read()
        except Exception as e:  # el servidor del INE corta conexiones a veces
            error = e
            time.sleep(3 * (intento + 1))
    raise error


def main():
    for destino, url in DESCARGAS.items():
        ruta = RAIZ / destino
        ruta.parent.mkdir(parents=True, exist_ok=True)
        datos = bajar(url)
        if len(datos) < 200:
            raise SystemExit(f"Descarga sospechosamente vacía: {url}")
        ruta.write_bytes(datos)
        print(f"OK {destino} ({len(datos):,} bytes)")


if __name__ == "__main__":
    main()
