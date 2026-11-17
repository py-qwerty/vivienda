"""Alquiler en Cataluña frente al resto de España, 2011-2024, a partir de SERPAVI (Ministerio de Vivienda).
Uso: python3 scripts/regulacion.py   (necesita raw/municipios/serpavi.xlsx, que baja municipios.py)
Escribe data/regulacion_series.json. Solo usa la biblioteca estándar.

Grupos (por código INE de municipio):
  - cat_zt:  municipios de Cataluña declarados zona de mercado residencial tensionado (data/zonas_tensionadas.json)
  - cat_no:  resto de municipios de Cataluña
  - resto:   resto de España, sin País Vasco ni Navarra (entran tarde en SERPAVI) ni Cataluña
Cada año: media de los alquileres medianos por m² de los municipios, ponderada por el número de contratos
(vivienda colectiva), y suma de contratos. Solo se cuentan municipios con dato ese año.
"""
import json
import pathlib
import re
import sys
import zipfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from municipios import filas_xlsx  # noqa: E402

BASE = pathlib.Path(__file__).resolve().parent.parent
CAT = ("08", "17", "25", "43")
EXCLUIDOS = CAT + ("01", "20", "48", "31")  # Cataluña, País Vasco y Navarra


def main():
    z = zipfile.ZipFile(BASE / "raw/municipios/serpavi.xlsx")
    filas = filas_xlsx(z, "Municipios")
    cab = next(filas)
    idx = {k: i for i, k in enumerate(cab)}
    anos = sorted({int(k[-2:]) + 2000 for k in cab if re.match(r"ALQM2_LV_M_VC_\d\d$", k)})
    zt = {m["codigo_ine"] for m in json.loads((BASE / "data/zonas_tensionadas.json").read_text(encoding="utf-8"))["municipios"]
          if m["comunidad"] == "Cataluña"}

    def num(f, k):
        return float(f[idx[k]]) if k in idx and idx[k] < len(f) and f[idx[k]] not in ("", None) else None

    acum = {g: {a: [0.0, 0.0, 0] for a in anos} for g in ("cat_zt", "cat_no", "resto")}  # suma(p*n), suma(n), municipios
    for f in filas:
        cod = str(f[idx["CUMUN"]]).zfill(5)
        if cod[:2] in CAT:
            g = "cat_zt" if cod in zt else "cat_no"
        elif cod[:2] in EXCLUIDOS:
            continue
        else:
            g = "resto"
        for a in anos:
            s = f"{a % 100:02d}"
            p = num(f, f"ALQM2_LV_M_VC_{s}")
            n = num(f, f"BI_ALVHEPCO_TVC_{s}")
            if p and n:
                t = acum[g][a]
                t[0] += p * n; t[1] += n; t[2] += 1

    out = {"anos": anos, "grupos": {}}
    for g, d in acum.items():
        out["grupos"][g] = {"eur_m2": [round(d[a][0] / d[a][1], 2) if d[a][1] else None for a in anos],
                            "contratos": [round(d[a][1]) for a in anos],
                            "municipios": [d[a][2] for a in anos]}
    (BASE / "data/regulacion_series.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    for g, d in out["grupos"].items():
        print(g, d["eur_m2"]); print("   contratos", d["contratos"]); print("   mun", d["municipios"])


if __name__ == "__main__":
    main()
