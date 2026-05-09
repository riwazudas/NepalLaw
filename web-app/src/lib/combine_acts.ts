import fs from 'fs';
import path from 'path';
import { parseMarkdown, LawAct, Section } from './ingest';

const LAWS_DIR = path.join(process.cwd(), '../data/laws');
const OUTPUT_DIR = path.join(process.cwd(), '../data/laws_json');

export async function runCombination() {
  console.log('=== Starting Sequential Act Combination ===');
  console.log('Source directory:', LAWS_DIR);
  console.log('Output directory:', OUTPUT_DIR);

  if (!fs.existsSync(LAWS_DIR)) {
    console.error('Laws directory not found:', LAWS_DIR);
    return;
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log('Created output directory:', OUTPUT_DIR);
  }

  const files = fs.readdirSync(LAWS_DIR).filter(f => f.endsWith('.md'));
  
  // Group files by base ID
  // e.g., arbitration_act_2055_english.md -> base ID: arbitration_act_2055
  const pairs: Record<string, { english?: string; nepali?: string }> = {};

  for (const file of files) {
    if (!file.endsWith('_english.md') && !file.endsWith('_nepali.md')) {
      continue;
    }
    const isEnglish = file.endsWith('_english.md');
    const baseId = file.replace(isEnglish ? '_english.md' : '_nepali.md', '');
    
    if (!pairs[baseId]) {
      pairs[baseId] = {};
    }
    
    if (isEnglish) {
      pairs[baseId].english = file;
    } else {
      pairs[baseId].nepali = file;
    }
  }

  const baseIds = Object.keys(pairs).sort();
  console.log(`Found ${baseIds.length} candidate acts for processing.`);

  let successCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < baseIds.length; i++) {
    const baseId = baseIds[i];
    const pair = pairs[baseId];
    console.log(`\n[${i + 1}/${baseIds.length}] Processing Act ID: "${baseId}"...`);

    if (!pair.english || !pair.nepali) {
      console.warn(`⚠️ Skipped "${baseId}": Missing ${!pair.english ? 'English' : 'Nepali'} companion file.`);
      skippedCount++;
      continue;
    }

    try {
      const engFilePath = path.join(LAWS_DIR, pair.english);
      const nepFilePath = path.join(LAWS_DIR, pair.nepali);

      console.log(`  - Reading English: ${pair.english}`);
      const engContent = fs.readFileSync(engFilePath, 'utf-8');
      console.log(`  - Reading Nepali: ${pair.nepali}`);
      const nepContent = fs.readFileSync(nepFilePath, 'utf-8');

      // Extract Year and Name from baseId
      const parts = baseId.split('_');
      const year = parts.find(p => /^\d{4}$/.test(p)) || '';
      const actName = parts.filter(p => !/^\d{4}$/.test(p) && p !== 'act').join(' ');

      // Parse markdown content
      console.log(`  - Parsing English markdown...`);
      const parsedEnglish = parseMarkdown(engContent);
      console.log(`    Found ${parsedEnglish.length} English sections.`);

      console.log(`  - Parsing Nepali markdown...`);
      const parsedNepali = parseMarkdown(nepContent);
      console.log(`    Found ${parsedNepali.length} Nepali sections.`);

      // Combine sections
      const sectionsMap: Record<string, Section> = {};

      for (const pSec of parsedEnglish) {
        sectionsMap[pSec.id] = {
          id: pSec.id,
          english: {
            title: pSec.title,
            content: pSec.content,
            partTitle: pSec.partTitle,
            chapterTitle: pSec.chapterTitle
          }
        };
      }

      for (const pSec of parsedNepali) {
        if (!sectionsMap[pSec.id]) {
          sectionsMap[pSec.id] = { id: pSec.id };
        }
        sectionsMap[pSec.id].nepali = {
          title: pSec.title,
          content: pSec.content,
          partTitle: pSec.partTitle,
          chapterTitle: pSec.chapterTitle
        };
      }

      // Preserve chronological/document order from English first, then remaining Nepali sections
      const sections: Section[] = [];
      for (const pSec of parsedEnglish) {
        sections.push(sectionsMap[pSec.id]);
      }
      for (const pSec of parsedNepali) {
        if (!sections.some(s => s.id === pSec.id)) {
          sections.push(sectionsMap[pSec.id]);
        }
      }

      const actData: LawAct = {
        id: baseId,
        actName: actName.toUpperCase().replace(/_/g, ' '),
        year,
        sections
      };

      // Output format matches public/knowledge_base.json format (an array of LawAct)
      const outputData = [actData];
      const outFilePath = path.join(OUTPUT_DIR, `${baseId}.json`);
      fs.writeFileSync(outFilePath, JSON.stringify(outputData, null, 2), 'utf-8');
      
      console.log(`  ✅ Successfully saved combined JSON to: ${path.relative(process.cwd(), outFilePath)}`);
      console.log(`     Total Combined Sections: ${sections.length}`);
      successCount++;
    } catch (err) {
      console.error(`  ❌ Error combining act "${baseId}":`, err);
    }
  }

  console.log('\n=== Sequential Combination Summary ===');
  console.log(`Processed: ${baseIds.length}`);
  console.log(`Successes: ${successCount}`);
  console.log(`Skipped:   ${skippedCount}`);
  console.log('======================================');
}

// Standalone execution entrypoint
if (require.main === module || (process.argv[1] && (process.argv[1].endsWith('combine_acts.ts') || process.argv[1].endsWith('combine_acts')))) {
  runCombination()
    .then(() => console.log('Act combination script finished.'))
    .catch(console.error);
}
