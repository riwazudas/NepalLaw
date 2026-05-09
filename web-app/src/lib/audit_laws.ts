import fs from 'fs';
import path from 'path';
import { LawAct, Section } from './ingest';

const LAWS_JSON_DIR = path.join(process.cwd(), '../data/laws_json');
const REPORT_OUTPUT_PATH = path.join(process.cwd(), '../data/laws_audit_report.md');

interface AuditRecord {
  file: string;
  actId: string;
  actName: string;
  year: string;
  totalSections: number;
  fullyBilingual: number;
  englishOnly: number;
  nepaliOnly: number;
  invalidSections: number;
  alignmentScore: number; // percentage of sections that are fully bilingual
  missingEnglishIds: string[];
  missingNepaliIds: string[];
}

export async function runAudit() {
  console.log('=== Starting Bilingual Laws JSON Audit ===');
  console.log('Target folder:', LAWS_JSON_DIR);

  if (!fs.existsSync(LAWS_JSON_DIR)) {
    console.error(`❌ Target directory does not exist: ${LAWS_JSON_DIR}`);
    return;
  }

  const files = fs.readdirSync(LAWS_JSON_DIR).filter(f => f.endsWith('.json'));
  console.log(`Found ${files.length} JSON files to audit.\n`);

  const records: AuditRecord[] = [];

  for (const file of files) {
    const filePath = path.join(LAWS_JSON_DIR, file);
    try {
      const rawContent = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(rawContent);

      // Schema verification: Must be an array of length 1 containing a LawAct
      if (!Array.isArray(parsed)) {
        throw new Error('Root element is not an array.');
      }
      if (parsed.length !== 1) {
        throw new Error(`Root array has length ${parsed.length} instead of 1.`);
      }

      const act: LawAct = parsed[0];
      if (!act.id || !act.actName || !act.year || !Array.isArray(act.sections)) {
        throw new Error('Required LawAct fields (id, actName, year, sections) are missing or invalid.');
      }

      let fullyBilingual = 0;
      let englishOnly = 0;
      let nepaliOnly = 0;
      let invalidSections = 0;
      const missingEnglishIds: string[] = [];
      const missingNepaliIds: string[] = [];

      for (const sec of act.sections) {
        const hasEng = sec.english && (sec.english.title || sec.english.content);
        const hasNep = sec.nepali && (sec.nepali.title || sec.nepali.content);

        if (hasEng && hasNep) {
          fullyBilingual++;
        } else if (hasEng && !hasNep) {
          englishOnly++;
          missingNepaliIds.push(sec.id);
        } else if (!hasEng && hasNep) {
          nepaliOnly++;
          missingEnglishIds.push(sec.id);
        } else {
          invalidSections++;
        }
      }

      const totalSections = act.sections.length;
      const alignmentScore = totalSections > 0 ? (fullyBilingual / totalSections) * 100 : 0;

      records.push({
        file,
        actId: act.id,
        actName: act.actName,
        year: act.year,
        totalSections,
        fullyBilingual,
        englishOnly,
        nepaliOnly,
        invalidSections,
        alignmentScore,
        missingEnglishIds,
        missingNepaliIds
      });

    } catch (err: any) {
      console.error(`❌ Failed auditing file "${file}": ${err.message}`);
    }
  }

  // Sort records by alignment score ascending (show problematic files first)
  records.sort((a, b) => a.alignmentScore - b.alignmentScore);

  // Generate console summary
  console.log('---------------------------------------------------------------------------------------------------------');
  console.log('| ' + 'Act ID'.padEnd(35) + ' | ' + 'Total Secs'.padStart(10) + ' | ' + 'Bilingual'.padStart(10) + ' | ' + 'Eng-Only'.padStart(10) + ' | ' + 'Nep-Only'.padStart(10) + ' | ' + 'Score'.padStart(8) + ' |');
  console.log('---------------------------------------------------------------------------------------------------------');
  
  let grandTotalSections = 0;
  let grandTotalBilingual = 0;
  let grandTotalEnglishOnly = 0;
  let grandTotalNepaliOnly = 0;

  for (const r of records) {
    grandTotalSections += r.totalSections;
    grandTotalBilingual += r.fullyBilingual;
    grandTotalEnglishOnly += r.englishOnly;
    grandTotalNepaliOnly += r.nepaliOnly;

    const scoreStr = `${r.alignmentScore.toFixed(1)}%`;
    console.log(
      `| ${r.actId.padEnd(35)} | ${String(r.totalSections).padStart(10)} | ${String(r.fullyBilingual).padStart(10)} | ${String(r.englishOnly).padStart(10)} | ${String(r.nepaliOnly).padStart(10)} | ${scoreStr.padStart(8)} |`
    );
  }
  console.log('---------------------------------------------------------------------------------------------------------');
  const grandScoreStr = `${(grandTotalBilingual / grandTotalSections * 100).toFixed(1)}%`;
  console.log(
    `| ${'GRAND TOTALS'.padEnd(35)} | ${String(grandTotalSections).padStart(10)} | ${String(grandTotalBilingual).padStart(10)} | ${String(grandTotalEnglishOnly).padStart(10)} | ${String(grandTotalNepaliOnly).padStart(10)} | ${grandScoreStr.padStart(8)} |`
  );
  console.log('---------------------------------------------------------------------------------------------------------');

  // Generate the detailed Markdown report content
  let md = `# Bilingual Laws JSON Integrity Audit Report\n\n`;
  md += `Generated on: \`${new Date().toISOString()}\`  \n`;
  md += `Target Folder: \`${LAWS_JSON_DIR}\`  \n\n`;

  md += `## Executive Summary\n\n`;
  md += `- **Total Acts Audited**: ${records.length}\n`;
  md += `- **Grand Total Sections**: ${grandTotalSections}\n`;
  md += `- **Fully Aligned Bilingual Sections**: ${grandTotalBilingual} (${grandScoreStr})\n`;
  md += `- **English-only Sections (Missing Nepali)**: ${grandTotalEnglishOnly}\n`;
  md += `- **Nepali-only Sections (Missing English)**: ${grandTotalNepaliOnly}\n\n`;

  if (grandTotalEnglishOnly === 0 && grandTotalNepaliOnly === 0) {
    md += `> [!NOTE]\n`;
    md += `> 🎉 **Perfect Bilingual Parity Achieved!** All parsed sections have valid title and content properties in both English and Nepali.\n\n`;
  } else {
    md += `> [!WARNING]\n`;
    md += `> ⚠️ **Alignment Discrepancies Found!** There are sections containing only one language, resulting in an overall alignment score of ${grandScoreStr}. See detailed analysis below to audit specific sections.\n\n`;
  }

  md += `## Act Parity Leaderboard\n\n`;
  md += `| Rank | Act Identifier | Total Sections | Bilingual Sections | English Only | Nepali Only | Parity Score |\n`;
  md += `|------|----------------|:--------------:|:------------------:|:------------:|:-----------:|:------------:|\n`;

  records.forEach((r, idx) => {
    const rank = idx + 1;
    const scoreStr = `${r.alignmentScore.toFixed(1)}%`;
    md += `| ${rank} | [\`${r.actId}\`](file:///d:/Downloads/NepalLaw/data/laws_json/${r.file}) | ${r.totalSections} | ${r.fullyBilingual} | ${r.englishOnly} | ${r.nepaliOnly} | **${scoreStr}** |\n`;
  });

  md += `\n## Detailed Discrepancy Analysis\n\n`;
  md += `This section highlights acts with a parity score of less than 100% and lists the specific section IDs that are missing translation fields.\n\n`;

  let issuesFound = false;
  for (const r of records) {
    if (r.alignmentScore === 100) continue;
    issuesFound = true;

    md += `### 📄 ${r.actName} (\`${r.actId}\`)\n\n`;
    md += `- **Parity Score**: ${r.alignmentScore.toFixed(1)}% (${r.fullyBilingual} / ${r.totalSections} sections)\n`;
    if (r.englishOnly > 0) {
      md += `- 🔴 **Missing Nepali Translation** in ${r.englishOnly} sections:\n`;
      md += `  \`${r.missingNepaliIds.join(', ')}\`\n`;
    }
    if (r.nepaliOnly > 0) {
      md += `- 🔵 **Missing English Translation** in ${r.nepaliOnly} sections:\n`;
      md += `  \`${r.missingEnglishIds.join(', ')}\`\n`;
    }
    md += `\n---\n\n`;
  }

  if (!issuesFound) {
    md += `*No discrepancies found across any acts. Full bilingual compliance.* \n`;
  }

  fs.writeFileSync(REPORT_OUTPUT_PATH, md, 'utf-8');
  console.log(`✅ Audit report written to: ${path.relative(process.cwd(), REPORT_OUTPUT_PATH)}`);
  console.log('==========================================');
}

// Standalone execution entrypoint
if (require.main === module || (process.argv[1] && (process.argv[1].endsWith('audit_laws.ts') || process.argv[1].endsWith('audit_laws')))) {
  runAudit()
    .then(() => console.log('Audit script finished.'))
    .catch(console.error);
}
