import fs from 'fs';
import path from 'path';
import { model } from './gemini';
import { LawAct } from './ingest';

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

export function runAudit(knowledgeBase: LawAct[]): AuditIssue[] {
  const issues: AuditIssue[] = [];

  for (const law of knowledgeBase) {
    const jsonFile = `${law.id}.json`;
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
            sourceFile: jsonFile,
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
            sourceFile: jsonFile,
            snippet: section.nepali?.content.substring(0, 150)
          },
          status: 'pending'
        });
      }

      // 2. Scan for Broken Cross-References
      if (hasEng && section.english) {
        const text = section.english.content;
        
        // Scan for "Section X" or "Article X" patterns (digits optionally followed by a single character suffix)
        const secMatches = text.matchAll(/(?:section|article)\s+([0-9]+[a-z]?)/gi);
        for (const match of secMatches) {
          const num = match[1].toLowerCase();
          const targetId = `sec_${num}`;
          if (!validSectionIds.has(targetId) && !validSectionIds.has(num)) {
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
                sourceFile: jsonFile,
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
                sourceFile: jsonFile,
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
            sourceFile: jsonFile,
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
            sourceFile: jsonFile,
            snippet: section.nepali.content
          },
          status: 'pending'
        });
      }
    }
  }

  // Deduplicate issues by ID to prevent key duplication warnings
  const uniqueIssues: AuditIssue[] = [];
  const seenIds = new Set<string>();
  for (const issue of issues) {
    if (!seenIds.has(issue.id)) {
      seenIds.add(issue.id);
      uniqueIssues.push(issue);
    }
  }

  return uniqueIssues;
}

export async function healIssue(issue: AuditIssue, knowledgeBase: LawAct[]): Promise<{ success: boolean; log: string }> {
  let log = `Initiating healing for issue ${issue.id}...\n`;

  try {
    const actId = issue.actId;
    const jsonFilePath = path.join(process.cwd(), '../data/laws_json', `${actId}.json`);
    
    if (!fs.existsSync(jsonFilePath)) {
      throw new Error(`Laws JSON file not found: ${jsonFilePath}`);
    }

    log += `[Disk Action] Loading and parsing laws JSON file: ${actId}.json...\n`;
    const fileContent = fs.readFileSync(jsonFilePath, 'utf-8');
    const parsed = JSON.parse(fileContent);
    const act = parsed[0];

    const sectionId = issue.details.sectionId!;
    const sectionIndex = act.sections.findIndex((s: any) => s.id === sectionId);
    
    if (sectionIndex === -1) {
      throw new Error(`Section "${sectionId}" not found in act "${actId}".`);
    }

    const section = act.sections[sectionIndex];

    if (issue.category === 'gap') {
      const targetLang = issue.details.language!;
      const sourceLang = targetLang === 'nepali' ? 'english' : 'nepali';
      
      const sourceData = section[sourceLang];
      if (!sourceData || !sourceData.content) {
        throw new Error(`Source section "${sectionId}" lacks content in source language "${sourceLang}".`);
      }

      const sourceContent = sourceData.content;
      const sourceTitle = sourceData.title;

      // Check for similarity/matching with existing target-only sections
      const candidates = act.sections.filter((s: any) => s[targetLang] && !s[sourceLang]);
      let matchedCandidate: any = null;

      if (candidates.length > 0) {
        log += `[LLM Action] Checking if the source section "${sectionId}" is similar to any of the ${candidates.length} unmatched target-language sections in the same act...\n`;
        
        const candidateDetails = candidates.map((c: any) => 
          `Candidate ID: ${c.id}\nTitle: "${c[targetLang]!.title}"\nContent:\n${c[targetLang]!.content}`
        ).join('\n\n---\n\n');

        const matchPrompt = `You are an expert legal alignment model.
We are analyzing Section "${sectionId}" of "${act.actName}".
We have the ${sourceLang} version of this section, but the ${targetLang} translation is missing.

Source (${sourceLang}) Section Details:
Title: "${sourceTitle}"
Content:
${sourceContent}

However, we have ${candidates.length} unmatched ${targetLang} sections in the same Act that do not have any ${sourceLang} counterpart. It is possible one of these is the exact same section, but parsed with a slightly different ID or title formatting.

Here are the unmatched ${targetLang} sections:
${candidateDetails}

Analyze if the Source section matches or is the direct translation of any of these unmatched ${targetLang} sections.
Return your response in strict JSON format:
{
  "isMatch": true or false,
  "matchedCandidateId": "the matched candidate ID (or null)",
  "reasoning": "brief explanation of why they match or do not match"
}
Ensure the output is valid JSON. Do not include markdown formatting like \`\`\`json.`;

        try {
          const matchResult = await model.generateContent(matchPrompt);
          let matchText = matchResult.response.text().trim();
          
          if (matchText.startsWith('```json')) {
            matchText = matchText.replace(/^```json/, '').replace(/```$/, '').trim();
          } else if (matchText.startsWith('```')) {
            matchText = matchText.replace(/^```/, '').replace(/```$/, '').trim();
          }

          const parsedMatch = JSON.parse(matchText);
          if (parsedMatch.isMatch && parsedMatch.matchedCandidateId) {
            const found = candidates.find((c: any) => c.id === parsedMatch.matchedCandidateId);
            if (found) {
              matchedCandidate = found;
              log += `[LLM Action] Similarity detected! Section matches unmatched target section "${matchedCandidate.id}" (${parsedMatch.reasoning}).\n`;
            }
          } else {
            log += `[LLM Action] No similar unmatched sections found. Proceeding with standard translation.\n`;
          }
        } catch (matchErr) {
          log += `[WARNING] Error during similarity matching: ${matchErr}. Proceeding with standard translation.\n`;
        }
      }

      if (matchedCandidate) {
        log += `[Self-Healing] Resolving mismatch by merging sections in JSON...\n`;
        
        // Merge candidate's targetLang data into current section
        section[targetLang] = matchedCandidate[targetLang];
        
        // Remove the matchedCandidate from act.sections
        act.sections = act.sections.filter((s: any) => s.id !== matchedCandidate.id);
        
        // Update section in act
        act.sections[sectionIndex] = section;
        
        log += `[Disk Action] Writing merged sections back to ${actId}.json with backup...\n`;
        writeWithBackup(jsonFilePath, JSON.stringify([act], null, 2));

        log += `[Disk Action] Syncing merged sections directly to global knowledge_base.json...\n`;
        const kbPath = path.join(process.cwd(), 'public/knowledge_base.json');
        if (fs.existsSync(kbPath)) {
          const kbContent = fs.readFileSync(kbPath, 'utf-8');
          const kb = JSON.parse(kbContent);
          const kbActIdx = kb.findIndex((l: any) => l.id === actId);
          if (kbActIdx !== -1) {
            // Remove candidate section
            let updatedSections = kb[kbActIdx].sections.filter((s: any) => s.id !== matchedCandidate.id);
            // Update current section
            updatedSections = updatedSections.map((s: any) => s.id === sectionId ? section : s);
            kb[kbActIdx].sections = updatedSections;
            fs.writeFileSync(kbPath, JSON.stringify(kb, null, 2), 'utf-8');
            log += `[Success] Global knowledge_base.json merged and synced.\n`;
          }
        }
        
        log += `[Healing Complete] Sections "${sectionId}" and "${matchedCandidate.id}" are now merged bilingually under "${sectionId}"!\n`;
        return { success: true, log };
      }

      log += `[LLM Action] Translating Section Title from ${sourceLang} to ${targetLang}...\n`;
      const titlePrompt = `Translate this legislative section heading to ${targetLang === 'nepali' ? 'Nepali (नेपाली)' : 'English'}. Output ONLY the translated heading: "${sourceTitle}"`;
      const titleResult = await model.generateContent(titlePrompt);
      const translatedTitle = titleResult.response.text().trim().replace(/^"|"$/g, '');

      log += `[LLM Action] Translating section "${sectionId}" from ${sourceLang} to ${targetLang}...\n`;
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

      let translatedPartTitle = undefined;
      if (sourceData.partTitle) {
        log += `[LLM Action] Translating Part Title...\n`;
        const partTitlePrompt = `Translate this legislative Part heading to ${targetLang === 'nepali' ? 'Nepali (नेपाली)' : 'English'}. Output ONLY the translated heading: "${sourceData.partTitle}"`;
        const partTitleResult = await model.generateContent(partTitlePrompt);
        translatedPartTitle = partTitleResult.response.text().trim().replace(/^"|"$/g, '');
      }

      let translatedChapterTitle = undefined;
      if (sourceData.chapterTitle) {
        log += `[LLM Action] Translating Chapter Title...\n`;
        const chapTitlePrompt = `Translate this legislative Chapter heading to ${targetLang === 'nepali' ? 'Nepali (नेपाली)' : 'English'}. Output ONLY the translated heading: "${sourceData.chapterTitle}"`;
        const chapTitleResult = await model.generateContent(chapTitlePrompt);
        translatedChapterTitle = chapTitleResult.response.text().trim().replace(/^"|"$/g, '');
      }

      log += `[Success] Synthesized translation for Section ${sectionId}.\n`;

      // Set target language data directly in the JSON section object
      section[targetLang] = {
        title: translatedTitle,
        content: translatedContent,
        ...(translatedPartTitle ? { partTitle: translatedPartTitle } : {}),
        ...(translatedChapterTitle ? { chapterTitle: translatedChapterTitle } : {})
      };

      // Update section in act
      act.sections[sectionIndex] = section;

      log += `[Disk Action] Writing updated act back to ${actId}.json with backup...\n`;
      writeWithBackup(jsonFilePath, JSON.stringify([act], null, 2));

      log += `[Disk Action] Directly updating section in global knowledge_base.json...\n`;
      const kbPath = path.join(process.cwd(), 'public/knowledge_base.json');
      if (fs.existsSync(kbPath)) {
        const kbContent = fs.readFileSync(kbPath, 'utf-8');
        const kb = JSON.parse(kbContent);
        const kbActIdx = kb.findIndex((l: any) => l.id === actId);
        if (kbActIdx !== -1) {
          kb[kbActIdx].sections = kb[kbActIdx].sections.map((s: any) => s.id === sectionId ? section : s);
          fs.writeFileSync(kbPath, JSON.stringify(kb, null, 2), 'utf-8');
          log += `[Success] Global knowledge_base.json synced successfully.\n`;
        }
      }

      log += `[Healing Complete] Section "${sectionId}" is now permanently bilingual in ${actId}.json and synced to the knowledge base!\n`;
      return { success: true, log };
    }

    if (issue.category === 'broken_link') {
      const lang = issue.details.language!;
      const targetRef = issue.details.targetRef!;
      
      const langData = section[lang];
      if (!langData || !langData.content) {
        throw new Error(`Section "${sectionId}" not found in language "${lang}".`);
      }

      const content = langData.content;
      const validSectionTitles = act.sections.map((s: any) => `${s.id}: ${s[lang]?.title || ''}`).join('\n');

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

      // Update section content inside JSON section object
      section[lang].content = correctedContent;
      act.sections[sectionIndex] = section;

      log += `[Disk Action] Writing updated act back to ${actId}.json with backup...\n`;
      writeWithBackup(jsonFilePath, JSON.stringify([act], null, 2));

      log += `[Disk Action] Directly updating section in global knowledge_base.json...\n`;
      const kbPath = path.join(process.cwd(), 'public/knowledge_base.json');
      if (fs.existsSync(kbPath)) {
        const kbContent = fs.readFileSync(kbPath, 'utf-8');
        const kb = JSON.parse(kbContent);
        const kbActIdx = kb.findIndex((l: any) => l.id === actId);
        if (kbActIdx !== -1) {
          kb[kbActIdx].sections = kb[kbActIdx].sections.map((s: any) => s.id === sectionId ? section : s);
          fs.writeFileSync(kbPath, JSON.stringify(kb, null, 2), 'utf-8');
          log += `[Success] Global knowledge_base.json synced successfully.\n`;
        }
      }

      log += `[Healing Complete] Section "${sectionId}" cross-reference corrected permanently in ${actId}.json and synced to the knowledge base!\n`;
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
  const fileDir = path.dirname(filePath);
  const backupDir = path.join(fileDir, '.backup');

  // Ensure backup directory exists
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // Backup existing file if present
  if (fs.existsSync(filePath)) {
    const baseName = path.basename(filePath);
    const backupPath = path.join(backupDir, `${Date.now()}_${baseName}`);
    fs.copyFileSync(filePath, backupPath);
  }

  // Write new file
  fs.writeFileSync(filePath, content, 'utf-8');
}
