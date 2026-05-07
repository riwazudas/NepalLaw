import fs from 'fs';
import path from 'path';

export interface SectionData {
  title: string;
  content: string;
  partTitle?: string;
  chapterTitle?: string;
}

export interface ParsedSection {
  id: string;
  title: string;
  content: string;
  partTitle?: string;
  chapterTitle?: string;
}

export interface Section {
  id: string;
  partId?: string;
  chapterId?: string;
  english?: SectionData;
  nepali?: SectionData;
}

export interface LawAct {
  id: string;
  actName: string;
  year: string;
  sections: Section[];
}

const LAWS_DIR = path.join(process.cwd(), '../data/laws');
const OUTPUT_FILE = path.join(process.cwd(), 'public/knowledge_base.json');

export async function runIngestion() {
  console.log('Starting ingestion from:', LAWS_DIR);
  
  if (!fs.existsSync(LAWS_DIR)) {
    console.error('Laws directory not found:', LAWS_DIR);
    return { success: false, error: 'Laws directory not found' };
  }

  const files = fs.readdirSync(LAWS_DIR).filter(f => f.endsWith('.md'));
  const actsMap: Record<string, LawAct> = {};
  let totalFiles = 0;
  let totalSectionsIngested = 0;

  for (const file of files) {
    try {
      const filePath = path.join(LAWS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      const parts = file.replace('.md', '').split('_');
      const language = parts[parts.length - 1] === 'nepali' ? 'nepali' : 'english';
      const year = parts.find(p => /^\d{4}$/.test(p)) || '';
      const actName = parts.filter(p => !/^\d{4}$/.test(p) && p !== 'english' && p !== 'nepali' && p !== 'act').join(' ');
      
      const baseId = file.replace('.md', '').replace('_english', '').replace('_nepali', '');
      
      if (!actsMap[baseId]) {
        actsMap[baseId] = {
          id: baseId,
          actName: actName.toUpperCase(),
          year,
          sections: []
        };
      }

      const parsedSections = parseMarkdown(content);
      
      // Merge into existing sections or add new ones
      for (const pSec of parsedSections) {
        let existingSec = actsMap[baseId].sections.find(s => s.id === pSec.id);
        if (!existingSec) {
          existingSec = { id: pSec.id };
          actsMap[baseId].sections.push(existingSec);
        }
        existingSec[language] = { 
          title: pSec.title, 
          content: pSec.content,
          partTitle: pSec.partTitle,
          chapterTitle: pSec.chapterTitle
        };
      }

      totalFiles++;
      totalSectionsIngested += parsedSections.length;
      console.log(`Ingested ${file}: ${parsedSections.length} sections (${language})`);
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }

  const knowledgeBase = Object.values(actsMap);
  
  // Ensure the directory for OUTPUT_FILE exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(knowledgeBase, null, 2));
  console.log('Knowledge base saved to:', OUTPUT_FILE);
  
  return {
    success: true,
    totalFiles,
    totalActs: knowledgeBase.length,
    totalSections: totalSectionsIngested,
    outputPath: OUTPUT_FILE
  };
}

export function parseMarkdown(content: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const lines = content.split('\n');
  
  let currentPartTitle: string | undefined = undefined;
  let currentChapterTitle: string | undefined = undefined;
  
  let currentTitle = 'Preamble';
  let currentContent = '';

  const addSection = (title: string, contentStr: string, pTitle?: string, cTitle?: string) => {
    const cleanContent = contentStr.trim();
    if (cleanContent === '---' || cleanContent.length < 3) {
      return;
    }

    // Standardize IDs across languages
    const nepaliDigits: Record<string, string> = { '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9' };
    const nepaliSuffixes: Record<string, string> = {
      'क': 'a', 'ख': 'b', 'ग': 'c', 'घ': 'd', 'ङ': 'e',
      'च': 'f', 'छ': 'g', 'ज': 'h', 'झ': 'i', 'ञ': 'j'
    };
    
    const keywords: Record<string, string> = {
      'section': 'sec', 'दफा': 'sec',
      'article': 'art', 'धारा': 'art',
      'part': 'part', 'भाग': 'part',
      'chapter': 'chap', 'परिच्छेद': 'chap',
      'schedule': 'sch', 'अनुसूची': 'sch',
      'annex': 'annex',
      'rule': 'rule', 'नियम': 'rule',
      'preamble': 'preamble', 'प्रस्तावना': 'preamble',
      'constitution': 'const', 'संविधान': 'const'
    };

    let sectionId = '';
    const keywordPattern = Object.keys(keywords).join('|');
    const match = title.match(new RegExp(`(?:(${keywordPattern}))?[^0-9०-९]*([0-9०-९]+)([a-zक-ञ])?`, 'i'));
    
    if (match && match[2]) {
      const keyword = match[1] ? match[1].toLowerCase() : '';
      const type = keywords[keyword] || 'sec';
      const numStr = match[2].split('').map(char => nepaliDigits[char] || char).join('');
      const suffix = match[3] ? (nepaliSuffixes[match[3]] || match[3].toLowerCase()) : '';
      sectionId = `${type}_${numStr}${suffix}`;
    } else if (/preamble|प्रस्तावना/i.test(title)) {
      sectionId = 'preamble';
    } else {
      // Fallback to slugified title
      sectionId = title.toLowerCase()
        .replace(/[:.]/g, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .split('_').filter(Boolean).slice(0, 3).join('_');
    }

    // Ensure uniqueness within the act
    let finalId = sectionId || 'section';
    let counter = 1;
    const baseId = finalId;
    while (sections.some(s => s.id === finalId)) {
      finalId = `${baseId}_${counter++}`;
    }

    sections.push({ 
      id: finalId, 
      title, 
      content: cleanContent,
      partTitle: pTitle,
      chapterTitle: cTitle
    });
  };

  for (const line of lines) {
    if (line.startsWith('#')) {
      if (currentContent.trim()) {
        addSection(currentTitle, currentContent, currentPartTitle, currentChapterTitle);
      }
      
      const headingText = line.replace(/^#+\s*/, '').trim();
      const level = (line.match(/^#+/) || [''])[0].length;
      
      if (level === 1) {
        // H1: Act Name
        currentTitle = headingText;
        currentContent = '';
      } else if (level === 2) {
        // H2: Part or Chapter or Preamble or Schedule
        if (/part|भाग/i.test(headingText)) {
          currentPartTitle = headingText;
          currentChapterTitle = undefined; // Reset chapter when a new part starts
        } else if (/chapter|परिच्छेद/i.test(headingText)) {
          currentChapterTitle = headingText;
        }
        
        currentTitle = headingText;
        currentContent = '';
      } else if (level === 3) {
        // H3: Section or Article
        currentTitle = headingText;
        currentContent = '';
      }
    } else {
      currentContent += line + '\n';
    }
  }

  if (currentContent.trim()) {
    addSection(currentTitle, currentContent, currentPartTitle, currentChapterTitle);
  }

  return sections;
}

// Standalone execution check
if (process.argv[1] && (process.argv[1].endsWith('ingest.ts') || process.argv[1].endsWith('ingest'))) {
  runIngestion()
    .then(result => console.log('Ingestion completed successfully:', result))
    .catch(console.error);
}
