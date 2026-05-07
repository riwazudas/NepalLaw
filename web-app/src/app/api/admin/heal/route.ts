import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { healIssue } from '@/lib/self_healing';

export async function POST(req: NextRequest) {
  try {
    const { issue } = await req.json();

    if (!issue) {
      return NextResponse.json({ success: false, error: 'Issue object is required' }, { status: 400 });
    }

    const kbPath = path.join(process.cwd(), 'public/knowledge_base.json');
    if (!fs.existsSync(kbPath)) {
      return NextResponse.json({ success: false, error: 'Knowledge base file not found' }, { status: 400 });
    }

    const kbContents = fs.readFileSync(kbPath, 'utf8');
    const knowledgeBase = JSON.parse(kbContents);

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
