import { copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import { strFromU8, unzipSync } from "fflate";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DATA = resolve(ROOT, "public", "data");
const OUTPUT_TTL = resolve(PUBLIC_DATA, "data.ttl");
const OUTPUT_JSON = resolve(PUBLIC_DATA, "animegraph.json");
const RETRYABLE_FILE_ERRORS = new Set(["EACCES", "EBUSY", "EPERM", "UNKNOWN"]);
const SOURCE_CANDIDATES = [
  resolve(ROOT, "..", "data", "processed", "data.ttl"),
  OUTPUT_TTL
];
const DATASET_DIR = resolve(ROOT, "Dataset");
const MAX_EXTERNAL_ANIME = 15000;
const EXTERNAL_DATASETS = [
  {
    path: resolve(DATASET_DIR, "anime export 2026-05-31 14-55-48.zip"),
    member: "anime export 2026-05-31 14-55-48.csv",
    source: "MAL export lokal 2026-05-31",
    kind: "mal_export"
  },
  {
    path: resolve(DATASET_DIR, "anime-dataset-2023.csv.zip"),
    member: "anime-dataset-2023.csv",
    source: "Kaggle MyAnimeList Dataset 2023 dbdmobile",
    kind: "kaggle_2023"
  },
  {
    path: resolve(DATASET_DIR, "archive.zip"),
    member: "Anime.csv",
    source: "Anime.csv archive lokal",
    kind: "anime_archive"
  }
];

const DATA_PREDICATES = {
  "rdfs:label": "label",
  "ag:entityType": "entityType",
  "ag:format": "format",
  "ag:genre": "genre",
  "ag:releaseYear": "year",
  "ag:description": "description",
  "ag:ragContext": "ragContext",
  "ag:source": "source"
};

const RELATION_PREDICATES = {
  "ag:producedBy": "producedBy",
  "ag:hasTheme": "hasTheme",
  "ag:featuresCharacter": "featuresCharacter",
  "ag:hasGenre": "hasGenre",
  "ag:relatedTo": "relatedTo"
};

function unquote(value) {
  const literal = value.match(/^"((?:\\.|[^"\\])*)"/);
  if (!literal) return value.trim();
  return literal[1]
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .replace(/\\n/g, "\n");
}

function resourceSlug(resource) {
  return resource.replace(/^ag:/, "");
}

function slug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "item";
}

function cleanText(value, maxLength = 0) {
  const cleaned = String(value || "")
    .replace(/\ufeff/g, " ")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\s+/g, " ");
  if (!cleaned || ["UNKNOWN", "N/A", "NULL", "NAN"].includes(cleaned.toUpperCase())) return "";
  if (maxLength && cleaned.length > maxLength) return `${cleaned.slice(0, maxLength - 3).trim()}...`;
  return cleaned;
}

function splitValues(value) {
  return cleanText(value)
    .replace(/\[|\]/g, "")
    .split(",")
    .map((item) => cleanText(item).replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

function dedupe(values, limit = 0) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const cleaned = cleanText(value);
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
    if (limit && result.length >= limit) break;
  }
  return result;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const cleaned = cleanText(value);
    if (cleaned) return cleaned;
  }
  return "";
}

function firstYear(...values) {
  for (const value of values) {
    const match = cleanText(value).match(/(19|20)\d{2}/);
    if (match) return match[0];
  }
  return "";
}

function numeric(value, fallback = 999999) {
  const match = cleanText(value).replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : fallback;
}

function normalizeFormat(value) {
  const cleaned = cleanText(value).toLowerCase().replace(/_/g, " ");
  const mapping = {
    tv: "TV Anime",
    movie: "Anime Film",
    ova: "OVA",
    ona: "ONA",
    special: "Special",
    music: "Music",
    web: "Web"
  };
  return mapping[cleaned] || (cleaned ? cleaned.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Anime");
}

function splitStatements(ttl) {
  const statements = [];
  let current = [];
  for (const rawLine of ttl.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("@prefix")) continue;
    current.push(line);
    if (line.endsWith(".")) {
      statements.push(current.join("\n"));
      current = [];
    }
  }
  return statements;
}

function parseStatement(statement) {
  const lines = statement.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const head = lines.shift();
  const headMatch = head?.match(/^(ag:[^\s]+)\s+a\s+(ag:[^\s;]+)\s*;?$/);
  if (!headMatch) return null;

  const subject = headMatch[1];
  const entity = {
    id: resourceSlug(subject),
    resource: subject,
    className: resourceSlug(headMatch[2]),
    label: resourceSlug(subject),
    entityType: "",
    format: "",
    genre: "",
    year: "",
    description: "",
    ragContext: "",
    source: "",
    relations: []
  };

  for (const line of lines) {
    const cleaned = line.replace(/[;.]\s*$/, "");
    const match = cleaned.match(/^([a-z]+:[^\s]+)\s+(.+)$/);
    if (!match) continue;

    const [, predicate, object] = match;
    const dataKey = DATA_PREDICATES[predicate];
    const relationKey = RELATION_PREDICATES[predicate];

    if (dataKey) {
      entity[dataKey] = unquote(object);
      continue;
    }

    if (relationKey && object.startsWith("ag:")) {
      entity.relations.push({
        predicate: relationKey,
        predicateUri: predicate,
        target: resourceSlug(object.trim())
      });
    }
  }

  return entity;
}

function enrichGraph(entities) {
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const incoming = new Map();

  for (const entity of entities) {
    entity.relations = entity.relations
      .filter((relation) => byId.has(relation.target) && relation.target !== entity.id)
      .map((relation) => {
        const target = byId.get(relation.target);
        if (!incoming.has(relation.target)) incoming.set(relation.target, []);
        incoming.get(relation.target).push({
          source: entity.id,
          sourceLabel: entity.label,
          predicate: relation.predicate,
          predicateUri: relation.predicateUri
        });
        return {
          ...relation,
          targetLabel: target.label,
          targetType: target.entityType,
          targetGenre: target.genre
        };
      });
  }

  for (const entity of entities) {
    entity.incoming = incoming.get(entity.id) || [];
    entity.degree = entity.relations.length + entity.incoming.length;
  }

  const types = countBy(entities, "entityType");
  const formats = countBy(entities, "format");
  const genres = countBy(entities, "genre");
  const topConnected = [...entities]
    .sort((a, b) => b.degree - a.degree || a.label.localeCompare(b.label))
    .slice(0, 18)
    .map(summaryEntity);

  return {
    generatedAt: new Date().toISOString(),
    source: "../data/processed/data.ttl",
    totalEntities: entities.length,
    relationCount: entities.reduce((sum, entity) => sum + entity.relations.length, 0),
    types,
    formats,
    genres,
    topConnected,
    entities
  };
}

function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows) {
    const value = row[key] || "Unknown";
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, count]) => ({ label, count }));
}

function summaryEntity(entity) {
  return {
    id: entity.id,
    resource: entity.resource,
    label: entity.label,
    entityType: entity.entityType,
    format: entity.format,
    genre: entity.genre,
    year: entity.year,
    description: entity.description,
    degree: entity.degree
  };
}

async function main() {
  const { path: sourcePath, ttl } = await readSourceTtl();
  const entities = splitStatements(ttl)
    .map(parseStatement)
    .filter(Boolean)
    .sort((a, b) => a.label.localeCompare(b.label));

  const externalAnime = await readExternalAnime();
  mergeExternalAnime(entities, externalAnime);

  const graph = enrichGraph(entities);
  if (!externalAnime.length && sourcePath === OUTPUT_TTL) {
    const existingGraph = await readExistingGraph();
    if (existingGraph?.totalEntities > graph.totalEntities) {
      console.log(`Kept existing expanded JSON with ${existingGraph.totalEntities} entities because external dataset zips were not available.`);
      return;
    }
  }

  await mkdir(PUBLIC_DATA, { recursive: true });
  if (sourcePath !== OUTPUT_TTL) {
    await copyFile(sourcePath, OUTPUT_TTL);
  }
  await writeFileAtomic(OUTPUT_JSON, JSON.stringify(graph));
  console.log(`Synced ${graph.totalEntities} RDF entities and ${graph.relationCount} relations.`);
}

async function writeFileAtomic(targetPath, contents) {
  const temporaryPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, contents, "utf8");

  try {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        await rename(temporaryPath, targetPath);
        return;
      } catch (error) {
        if (!RETRYABLE_FILE_ERRORS.has(error.code) || attempt === 7) throw error;
        const delay = Math.min(200 * 2 ** attempt, 3000);
        console.warn(`animegraph.json sedang dipakai proses lain. Mencoba lagi dalam ${delay}ms...`);
        await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
      }
    }
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => {});
  }
}

async function readExternalAnime() {
  const rows = [];
  for (const dataset of EXTERNAL_DATASETS) {
    try {
      const records = await readZipCsv(dataset);
      for (const record of records) {
        const entity = normalizeExternalRecord(record, dataset);
        if (entity) rows.push(entity);
      }
      console.log(`Loaded ${records.length} rows from ${dataset.source}.`);
    } catch (error) {
      console.warn(`Skipped ${dataset.source}: ${error.message}`);
    }
  }

  return rows
    .sort((a, b) => a.priority - b.priority || a.label.localeCompare(b.label))
    .slice(0, MAX_EXTERNAL_ANIME);
}

async function readZipCsv(dataset) {
  const zipped = new Uint8Array(await readFile(dataset.path));
  const files = unzipSync(zipped);
  const memberKey = Object.keys(files).find((key) => key === dataset.member || key.endsWith(dataset.member));
  if (!memberKey) throw new Error(`CSV member not found: ${dataset.member}`);
  const csvText = strFromU8(files[memberKey]);
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim()
  });
  if (parsed.errors.length) {
    const first = parsed.errors[0];
    console.warn(`CSV parse warning in ${dataset.member}: ${first.message}`);
  }
  return parsed.data;
}

function normalizeExternalRecord(row, dataset) {
  let label = "";
  let format = "";
  let genreValues = [];
  let studioValues = [];
  let year = "";
  let description = "";
  let priority = 999999;
  let metrics = "";

  if (dataset.kind === "mal_export") {
    label = cleanText(row.title);
    format = normalizeFormat(row.media_type);
    genreValues = splitValues(row.genres);
    studioValues = splitValues(row.studios);
    year = firstYear(row.start_season_year, row.start_date);
    description = cleanText(row.synopsis, 520);
    priority = numeric(row.rank, 999999) + numeric(row.popularity, 999999) / 100000;
    metrics = metricText({ score: row.mean, rank: row.rank, popularity: row.popularity, sourceMaterial: row.source });
  } else if (dataset.kind === "kaggle_2023") {
    label = firstNonEmpty(row["English name"], row.Name);
    format = normalizeFormat(row.Type);
    genreValues = splitValues(row.Genres);
    studioValues = splitValues(row.Studios);
    year = firstYear(row.Premiered, row.Aired);
    description = cleanText(row.Synopsis, 520);
    priority = numeric(row.Rank, 999999) + numeric(row.Popularity, 999999) / 100000;
    metrics = metricText({ score: row.Score, rank: row.Rank, popularity: row.Popularity, sourceMaterial: row.Source });
  } else {
    label = cleanText(row.Name);
    format = normalizeFormat(row.Type);
    genreValues = splitValues(row.Tags);
    studioValues = splitValues(row.Studio);
    year = firstYear(row.Release_year);
    description = cleanText(row.Description, 520);
    priority = numeric(row.Rank, 999999);
    metrics = metricText({ score: row.Rating, rank: row.Rank });
  }

  if (!label || !genreValues.length) return null;
  const genre = genreValues[0];
  const themes = dedupe(genreValues.slice(1), 8);
  const studios = dedupe(studioValues, 3);
  const ragContext = cleanText(
    `External dataset evidence for ${label}: format ${format}, genre ${genre}, release year ${year || "unknown"}. ${metrics}`,
    760
  );

  return {
    label,
    entityType: "Anime",
    format,
    genre,
    year,
    description: description || `${label} adalah entri anime yang diimpor dari dataset eksternal lokal.`,
    ragContext,
    source: dataset.source,
    studios,
    themes: themes.length ? themes : [genre],
    priority
  };
}

function metricText({ score, rank, popularity, sourceMaterial }) {
  const parts = [];
  if (cleanText(score)) parts.push(`score ${cleanText(score)}`);
  if (cleanText(rank)) parts.push(`rank ${cleanText(rank)}`);
  if (cleanText(popularity)) parts.push(`popularity ${cleanText(popularity)}`);
  if (cleanText(sourceMaterial)) parts.push(`source material ${cleanText(sourceMaterial)}`);
  return parts.length ? `Aggregate metadata: ${parts.join(", ")}.` : "";
}

function mergeExternalAnime(entities, externalAnime) {
  const byLabel = new Map(entities.map((entity) => [entity.label.toLowerCase(), entity]));
  const byId = new Map(entities.map((entity) => [entity.id, entity]));

  const ensureConcept = (label, entityType, format, genre, description) => {
    const key = label.toLowerCase();
    const existing = byLabel.get(key);
    if (existing) return existing;
    const id = uniqueId(slug(label), byId);
    const entity = {
      id,
      resource: `ag:${id}`,
      className: entityType.replace(/\s+/g, ""),
      label,
      entityType,
      format,
      genre,
      year: "",
      description,
      ragContext: `Concept node generated from external anime dataset for ${label}.`,
      source: "Generated from external anime dataset values",
      relations: [],
      incoming: [],
      degree: 0
    };
    entities.push(entity);
    byLabel.set(key, entity);
    byId.set(id, entity);
    return entity;
  };

  for (const anime of externalAnime) {
    const key = anime.label.toLowerCase();
    let entity = byLabel.get(key);
    if (!entity || entity.entityType !== "Anime") {
      const id = uniqueId(slug(anime.label), byId);
      entity = {
        id,
        resource: `ag:${id}`,
        className: classNameForFormat(anime.format),
        label: anime.label,
        entityType: "Anime",
        format: anime.format,
        genre: anime.genre,
        year: anime.year,
        description: anime.description,
        ragContext: anime.ragContext,
        source: anime.source,
        relations: [],
        incoming: [],
        degree: 0
      };
      entities.push(entity);
      byLabel.set(key, entity);
      byId.set(id, entity);
    } else {
      entity.format ||= anime.format;
      entity.genre ||= anime.genre;
      entity.year ||= anime.year;
      if (!entity.description || entity.description.length < 40) entity.description = anime.description;
      entity.ragContext = mergeText(entity.ragContext, anime.ragContext, 900);
      entity.source = mergeListText(entity.source, anime.source);
    }

    for (const studio of anime.studios) {
      const target = ensureConcept(studio, "Studio", "Organization", "Production", `Studio produksi yang muncul pada dataset eksternal: ${studio}.`);
      addRelation(entity, "producedBy", "ag:producedBy", target.id);
    }

    const genreNode = ensureConcept(anime.genre, "Genre", "Concept", anime.genre, `Genre anime untuk klasifikasi dan filter: ${anime.genre}.`);
    addRelation(entity, "hasGenre", "ag:hasGenre", genreNode.id);

    for (const theme of anime.themes) {
      const themeNode = ensureConcept(theme, "Theme", "Concept", "Theme", `Tema atau tag naratif dari dataset eksternal: ${theme}.`);
      addRelation(entity, "hasTheme", "ag:hasTheme", themeNode.id);
    }
  }
}

function uniqueId(base, byId) {
  let candidate = base || "item";
  let suffix = 2;
  while (byId.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function classNameForFormat(format) {
  if (format === "TV Anime") return "TVAnime";
  if (format === "Anime Film") return "AnimeFilm";
  return "Anime";
}

function addRelation(entity, predicate, predicateUri, target) {
  if (entity.relations.some((relation) => relation.predicate === predicate && relation.target === target)) return;
  entity.relations.push({ predicate, predicateUri, target });
}

function mergeText(current, extra, maxLength) {
  if (!extra || current.includes(extra)) return current;
  return cleanText(`${current} ${extra}`, maxLength);
}

function mergeListText(current, extra) {
  return dedupe([...String(current || "").split(";"), extra], 8).join("; ");
}

async function readExistingGraph() {
  try {
    return JSON.parse(await readFile(OUTPUT_JSON, "utf8"));
  } catch {
    return null;
  }
}

async function readSourceTtl() {
  for (const path of SOURCE_CANDIDATES) {
    try {
      return { path, ttl: await readFile(path, "utf8") };
    } catch {
      // Try the next candidate so the final repo can build from public/data/data.ttl.
    }
  }
  throw new Error("RDF source not found. Expected ../data/processed/data.ttl or public/data/data.ttl.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
