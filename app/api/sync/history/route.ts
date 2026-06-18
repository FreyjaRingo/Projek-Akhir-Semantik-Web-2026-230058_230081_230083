import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/sync/history - Get sync history
export async function GET() {
  try {
    const { data: history, error } = await supabase
      .from('SyncLog')
      .select('*')
      .order('startedAt', { ascending: false })
      .limit(50);

    if (error) {
      console.error('GET /api/sync/history error:', error);
      throw error;
    }

    const stats: Record<string, number> = {};
    history?.forEach(log => {
      stats[log.status] = (stats[log.status] || 0) + 1;
    });

    return NextResponse.json({
      history: history || [],
      stats,
    });
  } catch (error) {
    console.error('GET /api/sync/history error:', error);
    return NextResponse.json(
      { error: 'Failed to get sync history', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
