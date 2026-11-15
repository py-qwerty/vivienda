# Datos de vivienda por provincia

Base de datos con fuentes **oficiales** para visualizar, sin exagerar ni esconder, el peso de cada factor
en el problema de la vivienda: compradores extranjeros, pisos turísticos, empresas que compran vivienda
y subida del alquiler.

## Cómo actualizar

```bash
python scripts/descargar.py      # baja los ficheros originales a raw/
python scripts/construir_bd.py   # genera data/
```

Necesita Python 3 con `pandas` y `xlrd`.

## Qué se genera (`data/`)

| Fichero | Para qué |
|---|---|
| `vivienda.sqlite` | Base de datos completa (tablas `ccaa`, `provincias`, `fuentes`, `indicadores`, `observaciones` y vista `v_provincias`) |
| `observaciones.csv` | Las mismas observaciones en CSV, para Excel o cualquier herramienta |
| `mapa_provincias.json` | Último dato de cada capa por provincia, con la media nacional, el periodo y las fuentes: lo que leerá el mapa |

Los territorios usan los **códigos INE** de 2 dígitos (provincia `28` = Madrid, comunidad `13` = Comunidad de Madrid).

## Indicadores

| Indicador | Detalle | Periodo | Fuente |
|---|---|---|---|
| % de compras hechas por extranjeros (residentes y no residentes por separado) | 52 provincias | Trimestral 2007 → 2T 2026, anual y últimos 12 meses | Ministerio de Vivienda (escrituras notariales) |
| % de viviendas turísticas | 52 provincias | Semestral/trimestral 2020-08 → 2026-05 | INE, estadística experimental |
| Índice de precio del alquiler y subida desde 2015 | 48 provincias | Anual 2011 → 2024 | INE, IPVA (datos de Hacienda) |
| % de compras de vivienda hechas por empresas | **Solo nacional** | Anual 2007 → 2025 | INE, Transmisiones de Derechos de la Propiedad |

## Comprobaciones hechas

- La suma de las 52 provincias coincide **exactamente** con el total nacional en compras totales, de extranjeros residentes y de no residentes (últimos 12 meses).
- El total nacional de 2T 2026 (182.637 compraventas) coincide con la hoja original del Ministerio.
- Viviendas turísticas nacionales (341.001 en mayo de 2026) y su 1,28 % coinciden con lo publicado por el INE.

## Lo que estos datos NO dicen (leer antes de hacer el mapa)

1. **No hay un dato público de "fondos buitre" por provincia.** Lo más parecido es el % de compras hechas por
   empresas (personas jurídicas), y el INE solo lo publica a nivel nacional. Además, "empresa" incluye promotoras,
   sociedades familiares, bancos, SOCIMIs y fondos: es un **techo**, no la cifra de fondos.
   - Posibles vías para el detalle provincial: el Portal Estadístico del Notariado (penotariado.com, requiere
     registro) o pedirlo al Colegio de Registradores o a datos.gob.es.
2. **"Extranjero" no es "especulador".** Los extranjeros residentes compran sobre todo su propia vivienda. El
   indicador relevante para inversión o segunda residencia es el de **no residentes**.
3. **El IPVA sube menos que los anuncios**, porque mide todos los alquileres vigentes y no solo los contratos nuevos.
   **Falta País Vasco y Navarra** (tienen Hacienda propia y no entran en los datos de la Agencia Tributaria).
4. **Los pisos turísticos se cuentan por anuncios**, no por licencias, y el porcentaje usa como denominador las
   viviendas del censo.
5. El último trimestre del Ministerio es **provisional**.

## Primeras lecturas de los datos

Datos descargados el 15/11/2026.

- **Empresas compradoras (nacional):** el 11,3 % de las compras en 2025. El máximo fue el **21,9 % en 2013**,
  cuando fondos y bancos compraron vivienda barata tras la crisis.
- **Extranjeros:** el 16,4 % de las compras de los últimos 12 meses (9,9 % residentes y 6,4 % no residentes).
  Están muy concentrados: Alicante 47,5 %, Málaga 37,7 %, Baleares 33,6 %. En Sevilla o Badajoz, alrededor del 4 %.
- **Pisos turísticos:** el 1,28 % del total nacional. Los máximos están en Las Palmas (4,9 %), Málaga (4,5 %) y Girona (4,1 %).
- **Alquiler (contratos vigentes, 2015–2024):** +22,9 % en el conjunto de España. Las mayores subidas: Valencia +32,8 %, Málaga +30,3 %, Baleares +28,8 %.
