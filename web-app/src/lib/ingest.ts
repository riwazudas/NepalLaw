import fs from 'fs';
import path from 'path';

interface SectionData {
  title: string;
  content: string;
}

interface ParsedSection {
  id: string;
  title: string;
  content: string;
}

interface Section {
  id: string;
  english?: SectionData;
  nepali?: SectionData;
}

interface LawAct {
  id: string;
  actName: string;
  year: string;
  sections: Section[];
}

const LAWS_DIR = path.join(process.cwd(), '../data/laws');
const OUTPUT_FILE = path.join(process.cwd(), 'public/knowledge_base.json');

async function ingest() {
  console.log('Starting ingestion from:', LAWS_DIR);
  
  if (!fs.existsSync(LAWS_DIR)) {
    console.error('Laws directory not found:', LAWS_DIR);
    return;
  }

  const files = fs.readdirSync(LAWS_DIR).filter(f => f.endsWith('.md'));
  const actsMap: Record<string, LawAct> = {};

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
        existingSec[language] = { title: pSec.title, content: pSec.content };
      }

      console.log(`Ingested ${file}: ${parsedSections.length} sections (${language})`);
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }

  const knowledgeBase = Object.values(actsMap);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(knowledgeBase, null, 2));
  console.log('Knowledge base saved to:', OUTPUT_FILE);
}

function parseMarkdown(content: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const lines = content.split('\n');
  let currentTitle = 'Introduction';
  let currentContent = '';

  const addSection = (title: string, content: string) => {
    // Try to extract section number for stable ID (e.g., "Section 1" or "दफा १")
    const nepaliDigits: Record<string, string> = { '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9' };
    const sectionMatch = title.match(/(?:Section|दफा)\s*([0-9०-९]+)/i);
    let sectionId = '';
    
    if (sectionMatch) {
      const numStr = sectionMatch[1].split('').map(char => nepaliDigits[char] || char).join('');
      sectionId = `sec_${numStr}`;
    } else {
      // Fallback to slugified title
      sectionId = title.toLowerCase()
        .replace(/[:.]/g, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .split('_').slice(0, 3).join('_');
    }

    // Ensure uniqueness within the act
    let finalId = sectionId || `section_${sections.length + 1}`;
    if (sections.some(s => s.id === finalId)) {
      finalId = `${finalId}_${sections.length + 1}`;
    }

    sections.push({ 
      id: finalId, 
      title, 
      content: content.trim() 
    });
  };

  for (const line of lines) {
    if (line.startsWith('#')) {
      if (currentContent.trim()) {
        addSection(currentTitle, currentContent);
      }
      currentTitle = line.replace(/^#+\s*/, '').trim();
      currentContent = '';
    } else {
      currentContent += line + '\n';
    }
  }

  if (currentContent.trim()) {
    addSection(currentTitle, currentContent);
  }

  return sections;
}

ingest().catch(console.error);
