import fs from 'fs';
import path from 'path';

interface Section {
  title: string;
  content: string;
}

interface LawAct {
  id: string;
  actName: string;
  year: string;
  language: 'english' | 'nepali';
  sections: Section[];
}

const LAWS_DIR = path.join(process.cwd(), '../data/laws');
const OUTPUT_FILE = path.join(process.cwd(), 'src/data/knowledge_base.json');

async function ingest() {
  console.log('Starting ingestion from:', LAWS_DIR);
  
  if (!fs.existsSync(LAWS_DIR)) {
    console.error('Laws directory not found:', LAWS_DIR);
    return;
  }

  const files = fs.readdirSync(LAWS_DIR).filter(f => f.endsWith('.md'));
  const knowledgeBase: LawAct[] = [];

  for (const file of files) {
    try {
      const filePath = path.join(LAWS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Basic extraction of act name and language from filename
      // Format: arbitration_act_2055_english.md
      const parts = file.replace('.md', '').split('_');
      const language = parts[parts.length - 1] === 'nepali' ? 'nepali' : 'english';
      const year = parts.find(p => /^\d{4}$/.test(p)) || '';
      const actName = parts.filter(p => !/^\d{4}$/.test(p) && p !== 'english' && p !== 'nepali' && p !== 'act').join(' ');

      const sections = parseMarkdown(content);
      
      knowledgeBase.push({
        id: file.replace('.md', ''),
        actName: actName.toUpperCase(),
        year,
        language,
        sections
      });

      console.log(`Ingested ${file}: ${sections.length} sections`);
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(knowledgeBase, null, 2));
  console.log('Knowledge base saved to:', OUTPUT_FILE);
}

function parseMarkdown(content: string): Section[] {
  const sections: Section[] = [];
  // Split by headings (h1, h2, h3)
  const lines = content.split('\n');
  let currentTitle = 'Introduction';
  let currentContent = '';

  for (const line of lines) {
    if (line.startsWith('#')) {
      if (currentContent.trim()) {
        sections.push({ title: currentTitle, content: currentContent.trim() });
      }
      currentTitle = line.replace(/^#+\s*/, '');
      currentContent = '';
    } else {
      currentContent += line + '\n';
    }
  }

  if (currentContent.trim()) {
    sections.push({ title: currentTitle, content: currentContent.trim() });
  }

  return sections;
}

ingest().catch(console.error);
