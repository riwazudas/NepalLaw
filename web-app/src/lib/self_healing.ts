import fs from 'fs';
import path from 'path';
import { model } from './gemini';
import { runIngestion, LawAct } from './ingest';

export interface AuditIssue {
  id: string;
  actId: string;
  actName: string;
  category: 'gap' | 'broken_link' | 'formatting' | 'mismatch';
  severity: 'high' | 'medium' | 'low';
  description: string;
  details: {
    sectionId?: string;
    language?: 'english' | 'nepali';
    sourceFile?: string;
    companionFile?: string;
    targetRef?: string;
    snippet?: string;
    missingContentFrom?: string;
  };
  status: 'pending' | 'healing' | 'healed' | 'failed';
  error?: string;
}

const LAWS_DIR = path.join(process.cwd(), '../data/laws');
const BACKUP_DIR = path.join(LAWS_DIR, '.backup');

export function runAudit(knowledgeBase: LawAct[]): AuditIssue[] {
  const issues: AuditIssue[] = [];

  for (const law of knowledgeBase) {
    // Determine English and Nepali filenames based on law.id
    const engFile = `${law.id}_english.md`;
    const nepFile = `${law.id}_nepali.md`;
    
    const validSectionIds = new Set(law.sections.map(s => s.id));

    for (const section of law.sections) {
      // 1. Check Bilingual Gaps
      const hasEng = !!section.english;
      const hasNep = !!section.nepali;

      if (hasEng && !hasNep) {
        issues.push({
          id: `gap_${law.id}_${section.id}_nepali`,
          actId: law.id,
          actName: law.actName,
          category: 'gap',
          severity: 'high',
          description: `Section "${section.id}" exists in English, but Nepali translation is missing.`,
          details: {
            sectionId: section.id,
            language: 'nepali',
            sourceFile: engFile,
            companionFile: nepFile,
            snippet: section.english?.content.substring(0, 150)
          },
          status: 'pending'
        });
      } else if (!hasEng && hasNep) {
        issues.push({
          id: `gap_${law.id}_${section.id}_english`,
          actId: law.id,
          actName: law.actName,
          category: 'gap',
          severity: 'high',
          description: `Section "${section.id}" exists in Nepali, but English translation is missing.`,
          details: {
            sectionId: section.id,
            language: 'english',
            sourceFile: nepFile,
            companionFile: engFile,
            snippet: section.nepali?.content.substring(0, 150)
          },
          status: 'pending'
        });
      }

      // 2. Scan for Broken Cross-References
      if (hasEng && section.english) {
        const text = section.english.content;
        
        // Scan for "Section X" patterns
        const secMatches = text.matchAll(/section\s+([0-9a-z]+)/gi);
        for (const match of secMatches) {
          const num = match[1].toLowerCase();
          const targetId = `sec_${num}`;
          if (!validSectionIds.has(targetId) && !validSectionIds.has(num) && num !== 's' && num !== 'under' && num !== 'this') {
            issues.push({
              id: `ref_${law.id}_${section.id}_eng_${targetId}`,
              actId: law.id,
              actName: law.actName,
              category: 'broken_link',
              severity: 'medium',
              description: `English Section "${section.id}" references "${match[0]}", but target section ID "${targetId}" does not exist.`,
              details: {
                sectionId: section.id,
                language: 'english',
                targetRef: targetId,
                sourceFile: engFile,
                snippet: text.substring(Math.max(0, match.index! - 60), Math.min(text.length, match.index! + 60))
              },
              status: 'pending'
            });
          }
        }
      }

      if (hasNep && section.nepali) {
        const text = section.nepali.content;
        
        // Scan for "दफा X" patterns
        const secMatches = text.matchAll(/दफा\s+([०-९a-zA-Z]+)/g);
        for (const match of secMatches) {
          // Convert Nepali digits to English digits
          const nepDigits: Record<string, string> = { '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9' };
          const num = match[1].split('').map(char => nepDigits[char] || char).join('').toLowerCase();
          const targetId = `sec_${num}`;
          
          if (!validSectionIds.has(targetId) && !validSectionIds.has(num)) {
            issues.push({
              id: `ref_${law.id}_${section.id}_nep_${targetId}`,
              actId: law.id,
              actName: law.actName,
              category: 'broken_link',
              severity: 'medium',
              description: `Nepali Section "${section.id}" references "${match[0]}", but target section ID "${targetId}" does not exist.`,
              details: {
                sectionId: section.id,
                language: 'nepali',
                targetRef: targetId,
                sourceFile: nepFile,
                snippet: text.substring(Math.max(0, match.index! - 60), Math.min(text.length, match.index! + 60))
              },
              status: 'pending'
            });
          }
        }
      }

      // 3. Formatting & Truncation Checks
      if (hasEng && section.english && (section.english.content.length < 15 || section.english.content.includes('---'))) {
        issues.push({
          id: `format_${law.id}_${section.id}_english`,
          actId: law.id,
          actName: law.actName,
          category: 'formatting',
          severity: 'low',
          description: `English Section "${section.id}" has extremely short content or placeholder values.`,
          details: {
            sectionId: section.id,
            language: 'english',
            sourceFile: engFile,
            snippet: section.english.content
          },
          status: 'pending'
        });
      }
      if (hasNep && section.nepali && (section.nepali.content.length < 15 || section.nepali.content.includes('---'))) {
        issues.push({
          id: `format_${law.id}_${section.id}_nepali`,
          actId: law.id,
          actName: law.actName,
          category: 'formatting',
          severity: 'low',
          description: `Nepali Section "${section.id}" has extremely short content or placeholder values.`,
          details: {
            sectionId: section.id,
            language: 'nepali',
            sourceFile: nepFile,
            snippet: section.nepali.content
          },
          status: 'pending'
        });
      }
    }
  }

  return issues;
}

export async function healIssue(issue: AuditIssue, knowledgeBase: LawAct[]): Promise<{ success: boolean; log: string }> {
  let log = `Initiating healing for issue ${issue.id}...\n`;

  try {
    const act = knowledgeBase.find(l => l.id === issue.actId);
    if (!act) {
      throw new Error(`Act with ID "${issue.actId}" not found in knowledge base.`);
    }

    if (issue.category === 'gap') {
      const sectionId = issue.details.sectionId!;
      const targetLang = issue.details.language!;
      const sourceLang = targetLang === 'nepali' ? 'english' : 'nepali';
      
      const section = act.sections.find(s => s.id === sectionId);
      if (!section || !section[sourceLang]) {
        throw new Error(`Source section "${sectionId}" not found or lacks companion language content.`);
      }

      const sourceContent = section[sourceLang]!.content;
      const sourceTitle = section[sourceLang]!.title;

      log += `[LLM Action] Translating section "${sectionId}" from ${sourceLang} to ${targetLang}...\n`;
      
      // 1. Translate section using Gemini
      const translatePrompt = `You are a professional legislative translator. Translate the following official section from a Nepal Law Act into ${targetLang === 'nepali' ? 'Nepali (नेपाली)' : 'English'}.
      
      Requirements:
      1. Use precise formal legal vocabulary.
      2. Maintain matching sentence structures and references.
      3. Do not omit any sub-sections, clauses, or details.
      4. Do not include any explanations, introduction, or conversational filler. Output ONLY the translated content.
      
      Source Section Title: "${sourceTitle}"
      Source Content:
      ${sourceContent}`;

      const translationResult = await model.generateContent(translatePrompt);
      const translatedContent = translationResult.response.text().trim();
      
      log += `[LLM Action] Translating Section Title...\n`;
      const titlePrompt = `Translate this legislative section heading to ${targetLang === 'nepali' ? 'Nepali (नेपाली)' : 'English'}. Output ONLY the translated heading: "${sourceTitle}"`;
      const titleResult = await model.generateContent(titlePrompt);
      const translatedTitle = titleResult.response.text().trim().replace(/^"|"$/g, '');

      log += `[Success] Synthesized translation for Section ${sectionId}.\n`;

      // 2. Inject translated section into file
      const companionFileName = issue.details.companionFile!;
      const companionPath = path.join(LAWS_DIR, companionFileName);
      
      if (!fs.existsSync(companionPath)) {
        log += `Companion file does not exist. Creating a new file: ${companionFileName}\n`;
        const initialContent = `# ${act.actName}\n\n## Preamble\n\n### ${translatedTitle}\n\n${translatedContent}\n`;
        writeWithBackup(companionPath, initialContent);
      } else {
        log += `[Disk Action] Reading current content of ${companionFileName}...\n`;
        const companionFileContent = fs.readFileSync(companionPath, 'utf-8');

        log += `[LLM Action] Locating insertion point inside ${companionFileName}...\n`;
        const mergePrompt = `You are a markdown editor. We need to insert a newly translated legislative section into an existing Nepal Law markdown file.
        
        New Section to insert:
        Heading level: "###" (Use H3)
        Title: "${translatedTitle}"
        Content:
        ${translatedContent}

        Instructions:
        1. Look at the existing markdown content of the act and locate the proper chronological position for this section.
           Nepal Law sections are sequentially numbered (e.g., Section 1, Section 2... or दफा १, दफा २...).
        2. Insert the section cleanly with standard horizontal rules ("---") before it, matching the precise styling of the existing headings and paragraphs.
        3. Do not modify, edit, or delete any other part of the file.
        4. Return the ENTIRE, COMPLETE updated markdown file content. Do not truncate or use comments like "// rest of the file...". Just return full clean markdown. No conversational backticks or wraps except valid raw markdown.

        Existing Markdown Content:
        ${companionFileContent}`;

        const mergeResult = await model.generateContent(mergePrompt);
        let updatedMarkdown = mergeResult.response.text().trim();
        
        // Clean markdown wraps if the model returned them
        if (updatedMarkdown.startsWith('```markdown')) {
          updatedMarkdown = updatedMarkdown.replace(/^```markdown/, '').replace(/```$/, '').trim();
        } else if (updatedMarkdown.startsWith('```')) {
          updatedMarkdown = updatedMarkdown.replace(/^```/, '').replace(/```$/, '').trim();
        }

        log += `[Disk Action] Writing updated content back to ${companionFileName} with backup...\n`;
        writeWithBackup(companionPath, updatedMarkdown);
      }

      log += `[Success] Successfully written to disk! Triggering re-ingestion to sync index...\n`;
      await runIngestion();
      log += `[Healing Complete] Section "${sectionId}" is now bilingual in the knowledge base!\n`;
      return { success: true, log };
    }

    if (issue.category === 'broken_link') {
      const sectionId = issue.details.sectionId!;
      const lang = issue.details.language!;
      const sourceFile = issue.details.sourceFile!;
      const targetRef = issue.details.targetRef!;
      
      const section = act.sections.find(s => s.id === sectionId);
      if (!section || !section[lang]) {
        throw new Error(`Section "${sectionId}" not found in language "${lang}".`);
      }

      const content = section[lang]!.content;
      const validSectionTitles = act.sections.map(s => `${s.id}: ${s[lang]?.title || ''}`).join('\n');

      log += `[LLM Action] Reviewing broken reference "${targetRef}" in section "${sectionId}"...\n`;
      const resolvePrompt = `You are an expert legal auditor. In Section "${sectionId}" of "${act.actName}", there is a broken cross-reference pointing to "${targetRef}".
      This reference does not exist in the Act.
      
      Here is the content containing the broken reference:
      "${issue.details.snippet}"
      
      And here is a list of valid existing section IDs and titles in this Act:
      ${validSectionTitles}
      
      Instructions:
      1. Correct the reference inside the sentence if you can logically deduce the correct matching section from the Act context (e.g. if it meant Section 15 but typed Section 50, or refer to similar clauses).
      2. If it's ambiguous, do not make wild guesses; instead, rewrite the sentence to make the reference generic or point to the closest logical section, correcting grammatical structures.
      3. Return ONLY the fully corrected text of Section "${sectionId}". Do not include explanations.
      
      Current Full Content of Section "${sectionId}":
      ${content}`;

      const resolveResult = await model.generateContent(resolvePrompt);
      const correctedContent = resolveResult.response.text().trim();

      log += `[Disk Action] Replacing content in source file: ${sourceFile}...\n`;
      const sourcePath = path.join(LAWS_DIR, sourceFile);
      const fileContent = fs.readFileSync(sourcePath, 'utf-8');

      // Replace original section content with corrected content
      const replacePrompt = `You are a markdown text replacer. Replace the content of section heading "### ${section[lang]!.title}" with the new corrected content inside the file.
      
      Corrected Section Content to inject:
      ${correctedContent}
      
      Original File Content:
      ${fileContent}
      
      Return the ENTIRE, COMPLETE updated file content. Do not truncate. Just output valid raw markdown.`;

      const replaceResult = await model.generateContent(replacePrompt);
      let updatedMarkdown = replaceResult.response.text().trim();
      
      if (updatedMarkdown.startsWith('```markdown')) {
        updatedMarkdown = updatedMarkdown.replace(/^```markdown/, '').replace(/```$/, '').trim();
      } else if (updatedMarkdown.startsWith('```')) {
        updatedMarkdown = updatedMarkdown.replace(/^```/, '').replace(/```$/, '').trim();
      }

      writeWithBackup(sourcePath, updatedMarkdown);
      
      log += `[Success] Written corrections to ${sourceFile}. Triggering re-ingestion...\n`;
      await runIngestion();
      log += `[Healing Complete] Cross-reference repaired successfully!\n`;
      return { success: true, log };
    }

    throw new Error(`Unsupported healing category: "${issue.category}"`);
  } catch (error: any) {
    console.error('Healing failed:', error);
    log += `[ERROR] Healing failed: ${error.message || error}\n`;
    return { success: false, log };
  }
}

function writeWithBackup(filePath: string, content: string) {
  // Ensure backup directory exists
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Backup existing file if present
  if (fs.existsSync(filePath)) {
    const baseName = path.basename(filePath);
    const backupPath = path.join(BACKUP_DIR, `${Date.now()}_${baseName}`);
    fs.copyFileSync(filePath, backupPath);
  }

  // Write new file
  fs.writeFileSync(filePath, content, 'utf-8');
}
