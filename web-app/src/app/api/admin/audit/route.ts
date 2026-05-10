import { NextResponse } from 'next/server';
import { runAudit } from '@/lib/self_healing';
import { readJsonFromGCS } from '@/lib/gcs';

export async function GET() {
  try {
    let knowledgeBase: any;
    try {
      knowledgeBase = await readJsonFromGCS('knowledge_base.json');
    } catch (err: any) {
      return NextResponse.json({ 
        success: false, 
        error: 'Knowledge base not found: ' + err.message
      }, { status: 400 });
    }

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
