-- Base de datos de indicadores de vivienda por territorio
CREATE TABLE ccaa (
    cod_ccaa TEXT PRIMARY KEY,          -- código INE de 2 dígitos
    nombre   TEXT NOT NULL
);

CREATE TABLE provincias (
    cod_prov TEXT PRIMARY KEY,          -- código INE de 2 dígitos
    nombre   TEXT NOT NULL,
    cod_ccaa TEXT NOT NULL REFERENCES ccaa(cod_ccaa)
);

CREATE TABLE fuentes (
    id            TEXT PRIMARY KEY,
    organismo     TEXT NOT NULL,
    nombre        TEXT NOT NULL,
    url           TEXT NOT NULL,
    origen_datos  TEXT,                 -- de dónde saca el organismo el dato
    limitaciones  TEXT,                 -- lo que el dato NO dice
    fecha_descarga TEXT NOT NULL
);

CREATE TABLE indicadores (
    id          TEXT PRIMARY KEY,
    nombre      TEXT NOT NULL,
    unidad      TEXT NOT NULL,          -- número, %, índice
    fuente_id   TEXT NOT NULL REFERENCES fuentes(id),
    descripcion TEXT
);

CREATE TABLE observaciones (
    indicador_id TEXT NOT NULL REFERENCES indicadores(id),
    ambito       TEXT NOT NULL CHECK (ambito IN ('nacional','ccaa','provincia')),
    codigo       TEXT NOT NULL,         -- '00' nacional, cod_ccaa o cod_prov
    periodo      TEXT NOT NULL,         -- 2025 | 2026-T2 | 2026-05 | U4T-2026-T2 | 2015-2024
    tipo_periodo TEXT NOT NULL,         -- año | trimestre | mes | ultimos_12_meses | variacion
    valor        REAL NOT NULL,
    PRIMARY KEY (indicador_id, ambito, codigo, periodo, tipo_periodo)
);

CREATE INDEX idx_obs_mapa ON observaciones (indicador_id, ambito, periodo);

-- Vista cómoda: último dato de cada indicador por provincia con nombres
CREATE VIEW v_provincias AS
SELECT o.indicador_id, i.nombre AS indicador, i.unidad, o.periodo, o.tipo_periodo,
       p.cod_prov, p.nombre AS provincia, c.nombre AS ccaa, o.valor
FROM observaciones o
JOIN indicadores i ON i.id = o.indicador_id
JOIN provincias p ON p.cod_prov = o.codigo
JOIN ccaa c ON c.cod_ccaa = p.cod_ccaa
WHERE o.ambito = 'provincia';
