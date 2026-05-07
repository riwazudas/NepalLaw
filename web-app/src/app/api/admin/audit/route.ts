import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { runAudit } from '@/lib/self_healing';

export async function GET() {
  try {
    const kbPath = path.join(process.cwd(), 'public/knowledge_base.json');
    if (!fs.existsSync(kbPath)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Knowledge base not found. Please run ingestion first.' 
      }, { status: 400 });
    }

    const kbContents = fs.readFileSync(kbPath, 'utf8');
    const knowledgeBase = JSON.parse(kbContents);

    const issues = runAudit(knowledgeBase);
    
    // Sort issues by severity: high -> medium -> low
    const severityOrder = { high: 0, medium: 1, low: 2 };
    issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return NextResponse.json({
      success: true,
      totalIssues: issues.length,
      issues
    });
  } catch (error: any) {
    console.error('Audit API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}
