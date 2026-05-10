import { NextResponse } from 'next/server';
import { readJsonFromGCS } from '../../../lib/gcs';

export async function GET() {
  try {
    const data = await readJsonFromGCS('knowledge_base.json');
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Failed to load knowledge base from GCS/disk:', error);
    return NextResponse.json({ error: 'Failed to load knowledge base' }, { status: 500 });
  }
}
