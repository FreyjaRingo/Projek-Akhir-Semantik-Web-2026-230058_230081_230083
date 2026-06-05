const SPARQL_ENDPOINT = process.env.SPARQL_ENDPOINT || "https://query.wikidata.org/sparql";

function escapeSparqlString(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildAnimeSearchQuery(search) {
  const keyword = escapeSparqlString(search.trim());

  return `
    SELECT ?anime ?animeLabel ?description ?image ?genreLabel WHERE {
      ?anime wdt:P31/wdt:P279* wd:Q1107.
      ?anime rdfs:label ?animeLabel.

      FILTER(LANG(?animeLabel) = "en")
      FILTER(CONTAINS(LCASE(?animeLabel), LCASE("${keyword}")))

      OPTIONAL {
        ?anime schema:description ?description.
        FILTER(LANG(?description) = "en")
      }

      OPTIONAL {
        ?anime wdt:P136 ?genre.
        ?genre rdfs:label ?genreLabel.
        FILTER(LANG(?genreLabel) = "en")
      }

      OPTIONAL {
        ?anime wdt:P18 ?image.
      }
    }
    LIMIT 20
  `;
}

async function runSparqlQuery(query) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(SPARQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Accept: "application/sparql-results+json",
        "User-Agent": "AnimeGraphNexus/1.0 (semantic-web-final-project)"
      },
      body: new URLSearchParams({
        query,
        format: "json"
      }),
      signal: controller.signal
    });

    const text = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: text || "SPARQL request failed"
      };
    }

    return {
      ok: true,
      data: JSON.parse(text)
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    return response.status(405).json({
      ok: false,
      error: "Only GET requests are supported."
    });
  }

  try {
    const search = String(request.query.q || "");

    if (search.trim().length < 2) {
      return response.status(400).json({
        ok: false,
        error: "Query parameter 'q' minimal 2 karakter."
      });
    }

    const query = buildAnimeSearchQuery(search);
    const result = await runSparqlQuery(query);

    if (!result.ok) {
      return response.status(result.status || 500).json(result);
    }

    const bindings = result.data?.results?.bindings || [];
    const byUri = new Map();

    for (const item of bindings) {
      const uri = item.anime?.value;
      if (!uri) continue;

      const existing = byUri.get(uri);
      const genre = item.genreLabel?.value || null;

      if (existing) {
        if (genre && !existing.genres.includes(genre)) {
          existing.genres.push(genre);
        }
        continue;
      }

      byUri.set(uri, {
        id: uri.split("/").pop(),
        uri,
        title: item.animeLabel?.value || "Unknown title",
        description: item.description?.value || null,
        image: item.image?.value || null,
        genres: genre ? [genre] : []
      });
    }

    response.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");

    return response.status(200).json({
      ok: true,
      count: byUri.size,
      data: [...byUri.values()]
    });
  } catch (error) {
    return response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown server error"
    });
  }
};
