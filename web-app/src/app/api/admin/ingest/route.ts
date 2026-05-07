import { NextResponse } from 'next/server';
import { runIngestion } from '@/lib/ingest';

export async function POST() {
  try {
    const result = await runIngestion();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Ingestion Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to trigger ingestion' 
    }, { status: 500 });
  }
}
