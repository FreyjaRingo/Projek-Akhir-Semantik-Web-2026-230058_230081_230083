export function buildIndex(graph) {
  const entities = (graph?.entities || []).map((entity) => ({
    ...entity,
    searchText: [
      entity.label,
      entity.entityType,
      entity.format,
      entity.genre,
      entity.year,
      entity.description,
      entity.ragContext,
      entity.source
    ]
      .join(" ")
      .toLowerCase()
  }));
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const byLabel = new Map(entities.map((entity) => [entity.label.toLowerCase(), entity]));
  return { entities, byId, byLabel };
}

export function searchEntities(entities, query, filters) {
  const term = query.trim().toLowerCase();
  return entities
    .filter((entity) => {
      if (filters.type && entity.entityType !== filters.type) return false;
      if (filters.format && entity.format !== filters.format) return false;
      if (filters.genre && entity.genre !== filters.genre) return false;
      if (!term) return true;
      return entity.searchText.includes(term);
    })
    .sort((a, b) => scoreEntity(b, term) - scoreEntity(a, term) || b.degree - a.degree || a.label.localeCompare(b.label))
    .slice(0, 80);
}

function scoreEntity(entity, term) {
  if (!term) return entity.degree;
  const label = entity.label.toLowerCase();
  if (label === term) return 10000;
  if (label.startsWith(term)) return 5000 + entity.degree;
  if (label.includes(term)) return 2500 + entity.degree;
  return entity.degree;
}

export function relationTargets(entity, predicate) {
  return (entity?.relations || []).filter((relation) => relation.predicate === predicate);
}

export function relationLabels(entity, predicate) {
  return relationTargets(entity, predicate).map((relation) => relation.targetLabel);
}

export function animeEntities(index) {
  return index.entities.filter((entity) => entity.entityType === "Anime");
}

export function correlationCandidates(entity, index, limit = 12) {
  if (!entity) return [];
  return animeEntities(index)
    .filter((candidate) => candidate.id !== entity.id)
    .map((candidate) => scoreCorrelation(entity, candidate))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.sharedCount - a.sharedCount || a.entity.label.localeCompare(b.entity.label))
    .slice(0, limit);
}

export function compareEntities(first, second) {
  if (!first || !second) return null;
  const scored = scoreCorrelation(first, second);
  const sharedGroups = [
    { label: "Studio", values: scored.shared.producedBy },
    { label: "Genre", values: scored.shared.hasGenre.length ? scored.shared.hasGenre : first.genre === second.genre ? [first.genre] : [] },
    { label: "Theme", values: scored.shared.hasTheme },
    { label: "Character", values: scored.shared.featuresCharacter },
    { label: "Related Work", values: scored.shared.relatedTo }
  ].filter((group) => group.values.length);

  const bridge = sharedGroups.find((group) => group.values.length);
  const path = scored.direct
    ? `${first.label} -> ag:relatedTo -> ${second.label}`
    : bridge
      ? `${first.label} -> ${bridge.values[0]} -> ${second.label}`
      : "Belum ada jalur 2-hop yang kuat dari relasi RDF saat ini.";

  return {
    ...scored,
    first,
    second,
    sharedGroups,
    path
  };
}

function scoreCorrelation(first, second) {
  const shared = {
    producedBy: sharedRelationLabels(first, second, "producedBy"),
    hasGenre: sharedRelationLabels(first, second, "hasGenre"),
    hasTheme: sharedRelationLabels(first, second, "hasTheme"),
    featuresCharacter: sharedRelationLabels(first, second, "featuresCharacter"),
    relatedTo: sharedRelationLabels(first, second, "relatedTo")
  };

  const direct = hasDirectRelation(first, second);
  const sameGenre = first.genre && first.genre === second.genre;
  const sameFormat = first.format && first.format === second.format;
  let rawScore = 0;
  const reasons = [];

  if (direct) {
    rawScore += 48;
    reasons.push("terhubung eksplisit lewat ag:relatedTo");
  }
  if (shared.producedBy.length) {
    rawScore += Math.min(36, shared.producedBy.length * 28);
    reasons.push(`studio sama: ${shared.producedBy.slice(0, 2).join(", ")}`);
  }
  if (shared.hasGenre.length || sameGenre) {
    rawScore += shared.hasGenre.length ? Math.min(30, shared.hasGenre.length * 24) : 22;
    reasons.push(`genre sama: ${(shared.hasGenre[0] || first.genre)}`);
  }
  if (shared.hasTheme.length) {
    rawScore += Math.min(44, shared.hasTheme.length * 7);
    reasons.push(`tema sama: ${shared.hasTheme.slice(0, 4).join(", ")}`);
  }
  if (shared.featuresCharacter.length) {
    rawScore += Math.min(32, shared.featuresCharacter.length * 12);
    reasons.push(`karakter sama: ${shared.featuresCharacter.slice(0, 3).join(", ")}`);
  }
  if (shared.relatedTo.length) {
    rawScore += Math.min(24, shared.relatedTo.length * 8);
    reasons.push(`resource terkait sama: ${shared.relatedTo.slice(0, 3).join(", ")}`);
  }
  if (sameFormat) {
    rawScore += 4;
    reasons.push(`format sama: ${first.format}`);
  }

  const sharedCount = Object.values(shared).reduce((sum, values) => sum + values.length, 0) + (sameGenre ? 1 : 0) + (sameFormat ? 1 : 0);
  const score = Math.min(100, Math.round(rawScore));
  return {
    entity: second,
    score,
    shared,
    sharedCount,
    direct,
    reasons: reasons.length ? reasons : ["belum ada irisan semantik kuat"]
  };
}

function sharedRelationLabels(first, second, predicate) {
  const firstMap = relationMap(first, predicate);
  const secondMap = relationMap(second, predicate);
  return [...firstMap.keys()]
    .filter((id) => secondMap.has(id))
    .map((id) => firstMap.get(id) || secondMap.get(id))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function relationMap(entity, predicate) {
  return new Map(relationTargets(entity, predicate).map((relation) => [relation.target, relation.targetLabel]));
}

function hasDirectRelation(first, second) {
  return relationTargets(first, "relatedTo").some((relation) => relation.target === second.id)
    || relationTargets(second, "relatedTo").some((relation) => relation.target === first.id);
}

export function entityFacts(entity) {
  return [
    ["Resource", entity.resource],
    ["Type", entity.entityType],
    ["Format", entity.format],
    ["Genre", entity.genre],
    ["Year", entity.year || "-"],
    ["Degree", entity.degree],
    ["Source", entity.source]
  ];
}

export function sparqlDemoQueries(selected) {
  const resource = selected?.resource || "ag:steins_gate";
  const genreRelation = relationTargets(selected, "hasGenre")[0];
  const studioRelation = relationTargets(selected, "producedBy")[0];
  const genreResource = genreRelation ? `ag:${genreRelation.target}` : "ag:sci_fi";
  const studioResource = studioRelation ? `ag:${studioRelation.target}` : "ag:white_fox";

  return [
    {
      id: "search-title",
      label: "Search by Label",
      query: `${SPARQL_PREFIX}
SELECT ?resource ?label ?type ?genre
WHERE {
  ?resource rdfs:label ?label ;
            ag:entityType ?type ;
            ag:genre ?genre .
  FILTER(CONTAINS(LCASE(?label), "naruto"))
}
LIMIT 10`
    },
    {
      id: "entity-detail",
      label: "Entity Detail",
      query: `${SPARQL_PREFIX}
SELECT ?predicate ?object
WHERE {
  ${resource} ?predicate ?object .
}
LIMIT 20`
    },
    {
      id: "by-genre",
      label: "Anime by Genre",
      query: `${SPARQL_PREFIX}
SELECT ?anime ?label ?genre
WHERE {
  ?anime a ag:Anime ;
         rdfs:label ?label ;
         ag:hasGenre ${genreResource} .
}
LIMIT 12`
    },
    {
      id: "by-studio",
      label: "Anime by Studio",
      query: `${SPARQL_PREFIX}
SELECT ?anime ?label ?studio
WHERE {
  ?anime a ag:Anime ;
         rdfs:label ?label ;
         ag:producedBy ${studioResource} .
}
LIMIT 12`
    },
    {
      id: "top-connected",
      label: "Most Connected",
      query: `${SPARQL_PREFIX}
SELECT ?resource ?label ?degree
WHERE {
  ?resource rdfs:label ?label .
  ?resource ag:degree ?degree .
}
ORDER BY DESC(?degree)
LIMIT 10`
    },
    {
      id: "quality-coverage",
      label: "Quality Coverage",
      query: `${SPARQL_PREFIX}
SELECT ?metric ?value
WHERE {
  ?metric ag:computedFrom ag:AnimeGraph .
  ?metric ag:value ?value .
}`
    }
  ];
}

export function runSparqlDemoQuery(queryId, index, selected) {
  switch (queryId) {
    case "entity-detail":
      return rowsResult(
        ["predicate", "object"],
        [
          ...entityFacts(selected).map(([predicate, object]) => ({ predicate, object })),
          ...(selected?.relations || []).slice(0, 14).map((relation) => ({
            predicate: relation.predicateUri,
            object: relation.targetLabel
          }))
        ]
      );
    case "by-genre": {
      const genre = relationTargets(selected, "hasGenre")[0];
      const rows = animeEntities(index)
        .filter((entity) => {
          if (genre) return relationTargets(entity, "hasGenre").some((relation) => relation.target === genre.target);
          return selected?.genre && entity.genre === selected.genre;
        })
        .slice(0, 12)
        .map((entity) => ({ anime: entity.resource, label: entity.label, genre: selected?.genre || genre?.targetLabel || entity.genre }));
      return rowsResult(["anime", "label", "genre"], rows);
    }
    case "by-studio": {
      const studio = relationTargets(selected, "producedBy")[0];
      const rows = animeEntities(index)
        .filter((entity) => studio && relationTargets(entity, "producedBy").some((relation) => relation.target === studio.target))
        .slice(0, 12)
        .map((entity) => ({ anime: entity.resource, label: entity.label, studio: studio?.targetLabel || "-" }));
      return rowsResult(["anime", "label", "studio"], rows);
    }
    case "top-connected":
      return rowsResult(
        ["resource", "label", "degree"],
        [...index.entities]
          .sort((a, b) => b.degree - a.degree || a.label.localeCompare(b.label))
          .slice(0, 10)
          .map((entity) => ({ resource: entity.resource, label: entity.label, degree: entity.degree }))
      );
    case "quality-coverage": {
      const total = index.entities.length;
      const withRelations = index.entities.filter((entity) => entity.degree > 0).length;
      const relationCount = index.entities.reduce((sum, entity) => sum + entity.relations.length, 0);
      const averageDegree = total ? (index.entities.reduce((sum, entity) => sum + entity.degree, 0) / total).toFixed(2) : "0";
      return rowsResult(["metric", "value"], [
        { metric: "totalEntities", value: total },
        { metric: "explicitRelations", value: relationCount },
        { metric: "entitiesWithRelations", value: withRelations },
        { metric: "entitiesWithoutRelations", value: total - withRelations },
        { metric: "averageDegree", value: averageDegree }
      ]);
    }
    case "search-title":
    default:
      return rowsResult(
        ["resource", "label", "type", "genre"],
        searchEntities(index.entities, "naruto", { type: "", format: "", genre: "" })
          .slice(0, 10)
          .map((entity) => ({
            resource: entity.resource,
            label: entity.label,
            type: entity.entityType,
            genre: entity.genre
          }))
      );
  }
}

function rowsResult(columns, rows) {
  return { columns, rows };
}

const SPARQL_PREFIX = `PREFIX ag: <http://example.org/animegraph#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>`;

export function answerQuestion(question, index) {
  const cleaned = question.trim();
  if (!cleaned) return null;

  const lowered = cleaned.toLowerCase();
  const entity = detectEntity(cleaned, index);
  if (!entity) {
    const matches = searchEntities(index.entities, cleaned, { type: "", format: "", genre: "" }).slice(0, 5);
    return {
      title: "Entitas belum ditemukan",
      body: "AnimeGraph belum menemukan label persis. Kandidat terdekat ditampilkan sebagai fakta grounding.",
      facts: matches.map((item) => ({ predicate: item.resource, object: `${item.label} (${item.genre})` }))
    };
  }

  if (/(studio|produksi|diproduksi|creator)/i.test(lowered)) {
    const studios = relationLabels(entity, "producedBy");
    return {
      title: `Studio untuk ${entity.label}`,
      body: `${entity.label} terhubung dengan ${studios.join(", ") || "studio yang belum tersedia"}.`,
      facts: studios.map((name) => ({ predicate: "ag:producedBy", object: name }))
    };
  }

  if (/(tema|theme)/i.test(lowered)) {
    const themes = relationLabels(entity, "hasTheme").slice(0, 12);
    return {
      title: `Tema ${entity.label}`,
      body: `Tema utama ${entity.label}: ${themes.join(", ") || "belum tersedia"}.`,
      facts: themes.map((name) => ({ predicate: "ag:hasTheme", object: name }))
    };
  }

  if (/(karakter|character|siapa)/i.test(lowered)) {
    const characters = relationLabels(entity, "featuresCharacter").slice(0, 12);
    return {
      title: `Karakter ${entity.label}`,
      body: `Karakter yang terhubung dengan ${entity.label}: ${characters.join(", ") || "belum tersedia"}.`,
      facts: characters.map((name) => ({ predicate: "ag:featuresCharacter", object: name }))
    };
  }

  if (/(rekomendasi|mirip|similar|related|terkait)/i.test(lowered)) {
    const related = correlationCandidates(entity, index, 8);
    return {
      title: `Rekomendasi dari ${entity.label}`,
      body: related.length
        ? `Anime paling berkorelasi dengan ${entity.label}: ${related.map((item) => item.entity.label).join(", ")}.`
        : `Belum ada anime berkorelasi kuat untuk ${entity.label}.`,
      facts: related.map((item) => ({ predicate: `${item.score}% similarity`, object: `${item.entity.label} - ${item.reasons.slice(0, 2).join("; ")}` }))
    };
  }

  return {
    title: entity.label,
    body: `${entity.label} adalah ${entity.format} bergenre ${entity.genre}. ${entity.description}`,
    facts: [
      { predicate: "ag:description", object: entity.description },
      { predicate: "ag:ragContext", object: entity.ragContext }
    ]
  };
}

function detectEntity(text, index) {
  const lowered = text.toLowerCase();
  const byMention = [...index.entities]
    .sort((a, b) => b.label.length - a.label.length)
    .find((entity) => lowered.includes(entity.label.toLowerCase()));
  return byMention || index.byLabel.get(lowered);
}
