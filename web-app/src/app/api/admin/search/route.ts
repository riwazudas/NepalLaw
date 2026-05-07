import { NextRequest, NextResponse } from 'next/server';
import { searchKnowledgeBase } from '@/lib/retrieval';

export async function POST(req: NextRequest) {
  try {
    const { query, useReRanking } = await req.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const results = await searchKnowledgeBase(query, 10, !!useReRanking);

    return NextResponse.json({
      success: true,
      query,
      expandedQuery: query, // Note: can expand this if we return the expanded list from retrieval
      results
    });
  } catch (error: any) {
    console.error('Playground search error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}
