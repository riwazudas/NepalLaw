import fs from 'fs';
import path from 'path';

export interface SearchResult {
  actId: string;
  sectionId: string;
  actName: string;
  year: string;
  title: string;
  content: string;
  language: string;
  score: number;
}

export function searchKnowledgeBase(query: string, limit: number = 5): SearchResult[] {
  // Read the knowledge base from the public folder (single source of truth)
  const kbPath = path.join(process.cwd(), 'public/knowledge_base.json');
  if (!fs.existsSync(kbPath)) {
    console.error('Knowledge base file not found at:', kbPath);
    return [];
  }
  
  const knowledgeBase = JSON.parse(fs.readFileSync(kbPath, 'utf-8'));
  const results: SearchResult[] = [];
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  
  // Heuristic: check for Nepali characters to determine target language
  const isNepaliQuery = /[\u0900-\u097F]/.test(query);
  const targetLang = isNepaliQuery ? 'nepali' : 'english';

  for (const law of (knowledgeBase as any)) {
    for (const section of law.sections) {
      // Search in both languages if available
      const eng = section.english;
      const nep = section.nepali;
      
      let maxScore = 0;
      let matchedLang = targetLang;

      // Score English
      if (eng) {
        let engScore = 0;
        const text = (eng.title + ' ' + eng.content).toLowerCase();
        for (const term of queryTerms) {
          if (text.includes(term)) {
            engScore += 1;
            if (eng.title.toLowerCase().includes(term)) engScore += 2;
          }
        }
        if (engScore > maxScore) {
          maxScore = engScore;
          matchedLang = 'english';
        }
      }

      // Score Nepali
      if (nep) {
        let nepScore = 0;
        const text = (nep.title + ' ' + nep.content).toLowerCase();
        for (const term of queryTerms) {
          if (text.includes(term)) {
            nepScore += 1;
            if (nep.title.toLowerCase().includes(term)) nepScore += 2;
          }
        }
        // Give preference to targetLang if scores are equal
        if (nepScore > maxScore || (nepScore === maxScore && targetLang === 'nepali')) {
          maxScore = nepScore;
          matchedLang = 'nepali';
        }
      }

      if (maxScore > 0) {
        const bestData = section[matchedLang];
        results.push({
          actId: law.id,
          sectionId: section.id,
          actName: law.actName,
          year: law.year,
          title: bestData.title,
          content: bestData.content,
          language: matchedLang,
          score: maxScore
        });
      }
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
