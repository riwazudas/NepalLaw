import fs from 'fs';
import path from 'path';
import type { LawAct } from '../lib/ingest';
import { readJsonFromGCS } from '../lib/gcs';

async function main() {
  console.log('================================================================================');
  console.log('[Daily-Healer] Starting automated single-issue daily self-healing session...');
  console.log(`[Daily-Healer] Execution time: ${new Date().toISOString()}`);
  console.log('================================================================================');

  // Load .env.local manually if running in a standalone Node environment
  const envLocalPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    const envContent = fs.readFileSync(envLocalPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const equalsIdx = trimmed.indexOf('=');
        if (equalsIdx !== -1) {
          const key = trimmed.substring(0, equalsIdx).trim();
          let value = trimmed.substring(equalsIdx + 1).trim();
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.substring(1, value.length - 1);
          }
          process.env[key] = value;
        }
      }
    }
  }

  // Dynamically import healing and auditing logic after env variables have loaded to avoid module initialization race conditions
  const { runAudit, healIssue } = await import('../lib/self_healing');

  // Load knowledge base
  console.log('[Daily-Healer] Loading compiled knowledge base...');
  let knowledgeBase: LawAct[];
  try {
    knowledgeBase = await readJsonFromGCS('knowledge_base.json');
    console.log(`[Daily-Healer] Loaded ${knowledgeBase.length} legislative acts.`);
  } catch (err: any) {
    console.error('[Daily-Healer] ERROR loading knowledge base:', err.message);
    process.exit(1);
  }

  // Run audit diagnostics
  console.log('[Daily-Healer] Running comprehensive structural database audit...');
  const issues = runAudit(knowledgeBase);
  const pendingIssues = issues.filter(i => i.status === 'pending' || i.status === 'failed');

  console.log(`[Daily-Healer] Audit complete. Found ${issues.length} total issues (${pendingIssues.length} pending/failed).`);

  if (pendingIssues.length === 0) {
    console.log('[Daily-Healer] SUCCESS: All structural issues are already healed! Nothing to do.');
    console.log('================================================================================');
    return;
  }

  // Sort issues by severity: High (gaps) -> Medium (broken links) -> Low (formatting)
  const severityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const sortedIssues = [...pendingIssues].sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity]);

  // Isolate exactly one issue to heal
  const targetIssue = sortedIssues[0];
  console.log('\n[Daily-Healer] 🎯 Targeted Daily Healing Issue:');
  console.log(`- Issue ID:   ${targetIssue.id}`);
  console.log(`- Severity:   ${targetIssue.severity.toUpperCase()}`);
  console.log(`- Category:   ${targetIssue.category.toUpperCase()}`);
  console.log(`- Act Title:  ${targetIssue.actName}`);
  console.log(`- Description: ${targetIssue.description}`);
  console.log('--------------------------------------------------------------------------------');

  // Ensure Gemini API Key is configured
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error('[Daily-Healer] ERROR: GOOGLE_GENERATIVE_AI_API_KEY environment variable is not defined!');
    console.error('               Please supply your Gemini API key inside .env.local or your environment variables.');
    process.exit(1);
  }

  // Execute healing
  console.log('[Daily-Healer] Invoking Gemini legal healing agent...');
  const result = await healIssue(targetIssue, knowledgeBase);

  console.log('--------------------------------------------------------------------------------');
  if (result.success) {
    console.log('[Daily-Healer] 🎉 SUCCESS! The targeted issue has been fully repaired and synced to disk.');
    console.log('[Daily-Healer] Action log:');
    console.log(result.log);
    console.log('================================================================================');
  } else {
    console.error('[Daily-Healer] ❌ FAILED: The agent could not automatically heal the targeted issue.');
    console.error('[Daily-Healer] Error log:');
    console.error(result.log);
    console.log('================================================================================');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[Daily-Healer] FATAL execution error:', err);
  process.exit(1);
});
