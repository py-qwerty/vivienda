# AGENTS.md

Guía para cualquier agente (o persona) que trabaje en este repositorio.

## Qué es este proyecto

**En proporción** es una web que analiza problemas de España con **datos oficiales**, poniendo cada cifra en
su contexto y en la misma escala. La primera sección terminada es **Vivienda**: qué factores están asociados
al precio, componente a componente. Las demás secciones (Inmigración, Pensiones, Salarios, Empleo, Igualdad,
Salud) aparecen en la portada como "próximamente" con lo que incluirán.

- Web publicada: https://py-qwerty.github.io/vivienda/
- Repositorio: https://github.com/py-qwerty/vivienda

## Principios editoriales (obligatorios)

1. **Analizamos, no juzgamos.** Nada de preguntas retóricas ni sensacionalistas en titulares o textos
   ("¿Dónde aprieta más?", "de verdad", "faltan manos"…). Los titulares son descriptivos
   ("Diferencias entre provincias", "Coste del crédito hipotecario").
2. **No inducir la respuesta.** Las respuestas describen datos; si hay conclusión, se dice qué permiten
   concluir los datos y qué no, y en qué condiciones cambiaría.
3. **Solo fuentes oficiales para los datos** (INE, Ministerios, Banco de España, Agencia Tributaria,
   Registradores, BOE, EUR-Lex). Cifras de prensa o consultoras solo como referencia, marcadas
   "sin carácter oficial" y con su fuente.
4. **Cada bloque lleva su "Qué no dice"**: limitaciones, definiciones, cambios de método o cobertura.
5. **No inventar series.** Si solo hay puntos sueltos o métodos distintos, se muestran por separado y se
   explica por qué no hay serie. Los valores derivados se explican (p. ej. el reparto de 2016).
6. **Misma escala** al comparar barras, y siempre España frente a provincias o ciudades.
7. **Definir los términos cargados** (especulación, "fondo buitre", gran tenedor, persona jurídica…).
8. Textos en **español**, neutros, sin adjetivos valorativos.

## Estructura

```
scripts/
  descargar.py      # baja los ficheros originales a raw/ (no se versiona)
  construir_bd.py   # raw/ -> data/vivienda.sqlite, observaciones.csv, mapa_provincias.json
  componentes.py    # descargas y cargas de los componentes del precio
  territorios.py    # códigos INE de provincias y comunidades
  municipios.py     # datos por municipio (SERPAVI, renta INE, Catastro, pisos turísticos, zonas tensionadas)
                    # -> data/municipios.json y data/geo_municipios.json; solo biblioteca estándar
  certs/            # raíz de la FNMT, necesaria para descargar del Catastro con urllib
  regulacion.py     # serie trimestral de contratos nuevos de Cataluña (Incasòl, datos abiertos de la Generalitat)
                    # y SERPAVI por grupos -> data/regulacion_series.json y data/regulacion_municipios.json
  generar_web.py    # data/ + web/plantilla.html + web/recorrido.js -> web/index.html y web/municipios.json
  esquema.sql
data/
  vivienda.sqlite, observaciones.csv, mapa_provincias.json, geo_provincias.json   # generados
  normas.json             # normas de vivienda (manual, verificadas en BOE/EUR-Lex)
  inversion.json          # Registradores 2024, normas de inversión, estudios (manual)
  propiedad_alquiler.json # propiedad del alquiler, serie SERPAVI, Banco de España (manual)
  zonas_tensionadas.json  # zonas tensionadas declaradas, con código INE (manual, de la web del Ministerio)
  municipios.json, geo_municipios.json   # generados por municipios.py
web/
  plantilla.html   # HTML, CSS, mapa y portada de secciones
  recorrido.js     # pasos del recorrido de Vivienda (se inyecta en la plantilla)
  index.html       # GENERADO: no editar a mano
  municipios.json  # GENERADO: mapa municipal (geometría + datos), se carga al abrir el paso de inversión
.github/workflows/pages.yml   # publica web/ en GitHub Pages en cada push a main
```

## Flujo de trabajo

```bash
python scripts/descargar.py      # solo si hay que actualizar datos de origen
python scripts/construir_bd.py   # regenera data/
python3 scripts/municipios.py    # datos por municipio (descarga ~480 MB; --sin-descarga reutiliza raw/)
python3 scripts/regulacion.py    # regulación del alquiler (necesita raw/municipios/serpavi.xlsx; --sin-descarga)
python scripts/generar_web.py    # regenera web/index.html
python -m http.server 5501 --directory web   # vista local en http://localhost:5501
```

- Edita `web/plantilla.html` o `web/recorrido.js`, **nunca** `web/index.html`; después ejecuta
  `generar_web.py` y comprueba en el navegador que no hay errores de consola.
- Los datos manuales (`data/*.json` no generados) llevan `fuente` y `fuente_txt` en cada dato.
- Commits en español, describiendo el cambio. El push a `main` publica la web (tarda 1–2 minutos).
- `raw/` no se versiona (~60 MB); se recrea con `descargar.py`.

## Recorrido de Vivienda (`PASOS` en `web/recorrido.js`)

1. **El precio**: vivienda frente a sueldos e IPC.
2. **Hogares**: hogares nuevos frente a viviendas terminadas, con el apartado *Origen de los hogares*.
3. **Construcción y costes**: viviendas terminadas e iniciadas, plazos, normas; apartado *Empleo y suelo*.
4. **Crédito**: interés de las hipotecas, inflación e hipotecas firmadas.
5. **Inversión y especulación** (id `compradores`): compras de empresas, no residentes y sin hipoteca frente al
   precio; precio de compra frente a alquiler; **mapa municipal** con los criterios de zona tensionada de la
   Ley 12/2023 calculados año a año (2016–2024), zonas declaradas, concentración de la propiedad (Catastro) y
   pisos turísticos; concentración y precio; propiedad del alquiler; viviendas vacías; estudios; **análisis
   final** (compras de inversión y precio, concentración y tensión) y regulación.
6. **Regulación del alquiler** (id `regulacion`): gráfico trimestral de renta y número de contratos nuevos en
   Cataluña (fianzas del Incasòl) con dos vistas, Ley 11/2020 (61 municipios, 2020–2022) y zonas tensionadas
   de 2024; **mapa de municipios regulados** por fecha con ficha y serie de cada uno (Incasòl en Cataluña,
   SERPAVI fuera); tabla antes/después; cronología; casos (Berlín) y estudios.
7. **Por provincia**: mapa con capas (hogares por vivienda, extranjeros, no residentes, pisos turísticos,
   viviendas vacías, alquiler).
8. **Resumen**.

Un paso puede incluir otros como apartados mediante `UNIDOS` (`origen` dentro de `hogares`, `costes` dentro
de `construccion`); los enlaces antiguos redirigen al paso padre.

## Huecos de datos conocidos

- No hay estadística oficial de la propiedad del alquiler por tipo de propietario año a año: el reparto
  existe solo para 2023 (y particulares en 2016). Empresas: estimaciones del Banco de España sin serie.
- No hay dato oficial de fondos por separado, ni de grandes tenedores por barrio, ni de compras para revender.
- Compras de empresas: solo dato nacional (INE).
- Datos fiscales (IRPF) llegan con más de un año de retraso; 2025 se espera hacia mediados de 2027.
- País Vasco y Navarra quedan fuera de las fuentes de la Agencia Tributaria (hacienda foral) y del Catastro
  estatal; en SERPAVI entran tarde (Navarra 2021, Gipuzkoa 2022, Álava y Bizkaia 2024).
- El Catastro mide la concentración dentro de cada municipio (un titular con viviendas en varios municipios
  cuenta por separado en cada uno). No hay alquiler por tipo de propietario en ninguna fuente oficial.
- Fuera de Cataluña no hay serie oficial de contratos nuevos por municipio descargable (el País Vasco publica la
  EMAL solo en informes y visor GIS); las zonas declaradas en 2025–2026 aún no se pueden evaluar con SERPAVI.
- El criterio a) de zona tensionada solo se puede aproximar (sin gastos ni suministros, renta de todos los
  hogares): se muestra como dato continuo, no como criterio cumplido.
