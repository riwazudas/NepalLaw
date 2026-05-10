import { NextRequest, NextResponse } from 'next/server';
import { healIssue } from '@/lib/self_healing';
import { readJsonFromGCS } from '@/lib/gcs';

export async function POST(req: NextRequest) {
  try {
    const { issue } = await req.json();

    if (!issue) {
      return NextResponse.json({ success: false, error: 'Issue object is required' }, { status: 400 });
    }

    let knowledgeBase: any;
    try {
      knowledgeBase = await readJsonFromGCS('knowledge_base.json');
    } catch (err: any) {
      return NextResponse.json({ success: false, error: 'Knowledge base file not found: ' + err.message }, { status: 400 });
    }

    log(`API called to heal issue: ${issue.id}`);
    const result = await healIssue(issue, knowledgeBase);

    return NextResponse.json({
      success: result.success,
      log: result.log
    });
  } catch (error: any) {
    console.error('Heal API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}

function log(msg: string) {
  console.log(`[Heal API] ${msg}`);
}
