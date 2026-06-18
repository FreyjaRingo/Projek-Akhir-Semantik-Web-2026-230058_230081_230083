import { NextRequest, NextResponse } from 'next/server';

const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';

export async function GET(request: NextRequest) {
  const keyword = request.nextUrl.searchParams.get('q')?.trim() || '';

  if (keyword.length < 2 || keyword.length > 80) {
    return NextResponse.json({ ok: false, error: 'Kata kunci harus terdiri dari 2 sampai 80 karakter.' }, { status: 400 });
  }

  const escapedKeyword = keyword.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const query = `
    SELECT ?anime ?animeLabel ?description ?image
           (GROUP_CONCAT(DISTINCT ?genreLabel; separator="|") AS ?genres)
    WHERE {
      ?anime wdt:P31/wdt:P279* wd:Q1107;
             rdfs:label ?searchLabel.
      FILTER(LANG(?searchLabel) IN ("en", "id"))
      FILTER(CONTAINS(LCASE(STR(?searchLabel)), LCASE("${escapedKeyword}")))
      OPTIONAL { ?anime schema:description ?description. FILTER(LANG(?description) = "en") }
      OPTIONAL { ?anime wdt:P18 ?image. }
      OPTIONAL {
        ?anime wdt:P136 ?genre.
        ?genre rdfs:label ?genreLabel.
        FILTER(LANG(?genreLabel) = "en")
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "id,en". }
    }
    GROUP BY ?anime ?animeLabel ?description ?image
    LIMIT 12
  `;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const url = new URL(WIKIDATA_ENDPOINT);
    url.searchParams.set('query', query);
    url.searchParams.set('format', 'json');

    const response = await fetch(url, {
      headers: {
        Accept: 'application/sparql-results+json',
        'User-Agent': 'AnimeGraph-Nexus/1.0 (educational semantic web project)',
      },
      next: { revalidate: 900 },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Wikidata mengembalikan status ${response.status}.`);
    const payload = await response.json();
    const data = (payload.results?.bindings || []).map((row: any) => ({
      uri: row.anime?.value || '',
      title: row.animeLabel?.value || 'Tanpa judul',
      description: row.description?.value || '',
      image: row.image?.value || '',
      genres: row.genres?.value ? row.genres.value.split('|').filter(Boolean) : [],
    }));

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'Wikidata tidak merespons dalam batas waktu.'
      : error instanceof Error ? error.message : 'Pencarian Wikidata gagal.';
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
