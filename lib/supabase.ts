import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serverKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL belum diatur. Lihat .env.example.');
}

if (!serverKey && !publishableKey) {
  throw new Error('Atur SUPABASE_SECRET_KEY atau NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY di environment server.');
}

const auth = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
};

// Semua import saat ini berasal dari Server Components dan Route Handlers.
// Secret key tidak pernah memakai prefix NEXT_PUBLIC_ sehingga tidak masuk bundle browser.
export const supabase = createClient(supabaseUrl, serverKey || publishableKey!, { auth });

export function createAdminClient() {
  if (!serverKey) {
    throw new Error('SUPABASE_SECRET_KEY atau SUPABASE_SERVICE_ROLE_KEY diperlukan untuk operasi admin.');
  }
  return createClient(supabaseUrl, serverKey, { auth });
}

export type AnimeType = 'TV' | 'MOVIE' | 'OVA' | 'SPECIAL' | 'ONA' | 'MUSIC';
export type AnimeStatus = 'AIRING' | 'COMPLETED' | 'TO_BE_AIRED' | 'CANCELLED' | 'HIATUS';

export interface Anime {
  id: string;
  malId: number | null;
  title: string;
  titleEnglish: string | null;
  titleJapanese: string | null;
  description: string | null;
  imageUrl: string | null;
  score: number | null;
  scoredBy: number | null;
  rank: number | null;
  popularity: number | null;
  episodes: number | null;
  duration: number | null;
  type: AnimeType;
  status: AnimeStatus;
  year: number | null;
  season: string | null;
  source: string | null;
  rating: string | null;
  broadcast: string | null;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt: string | null;
}
