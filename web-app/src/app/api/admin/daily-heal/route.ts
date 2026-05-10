import { NextRequest, NextResponse } from 'next/server';
import { runAudit, healIssue } from '@/lib/self_healing';
import { readJsonFromGCS } from '@/lib/gcs';

export async function POST(req: NextRequest) {
  try {
    // 1. Verify cron secret key to prevent public abuse or unauthorized billing charges
    const authHeader = req.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;
    
    if (expectedSecret && authHeader !== expectedSecret) {
      console.warn('[Cloud-Healer] Blocked unauthorized daily-heal execution trigger.');
      return NextResponse.json({ success: false, error: 'Unauthorized execution request' }, { status: 401 });
    }

    console.log('[Cloud-Healer] Starting secure daily automated healing session...');

    // 2. Load the compiled master index
    let knowledgeBase: any;
    try {
      knowledgeBase = await readJsonFromGCS('knowledge_base.json');
    } catch (err: any) {
      return NextResponse.json({ success: false, error: 'Database loading failed: ' + err.message }, { status: 500 });
    }

    // 3. Run audit diagnostics
    const issues = runAudit(knowledgeBase);
    const pendingIssues = issues.filter(i => i.status === 'pending' || i.status === 'failed');

    if (pendingIssues.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All legislative structures are already fully healthy! Nothing to heal.'
      });
    }

    // 4. Sort and isolate the single highest-severity issue
    const severityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
    const sortedIssues = [...pendingIssues].sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity]);
    const targetIssue = sortedIssues[0];

    console.log(`[Cloud-Healer] Selected issue for automated daily healing: ${targetIssue.id}`);

    // Ensure Gemini Key is defined
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json({ success: false, error: 'Gemini API key is unconfigured on Cloud Run environment' }, { status: 500 });
    }

    // 5. Trigger healing
    const result = await healIssue(targetIssue, knowledgeBase);

    return NextResponse.json({
      success: result.success,
      healedIssueId: targetIssue.id,
      log: result.log
    });

  } catch (error: any) {
    console.error('[Cloud-Healer] Error during daily heal cycle:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal Server Error'
    }, { status: 500 });
  }
}
