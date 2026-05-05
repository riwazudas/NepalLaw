import knowledgeBase from '../data/knowledge_base.json';

export interface SearchResult {
  actName: string;
  year: string;
  title: string;
  content: string;
  language: string;
  score: number;
}

export function searchKnowledgeBase(query: string, limit: number = 5): SearchResult[] {
  const results: SearchResult[] = [];
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

  for (const law of (knowledgeBase as any)) {
    for (const section of law.sections) {
      let score = 0;
      const text = (section.title + ' ' + section.content).toLowerCase();
      
      for (const term of queryTerms) {
        if (text.includes(term)) {
          score += 1;
          // Bonus for exact match in title
          if (section.title.toLowerCase().includes(term)) {
            score += 2;
          }
        }
      }

      if (score > 0) {
        results.push({
          actName: law.actName,
          year: law.year,
          title: section.title,
          content: section.content,
          language: law.language,
          score
        });
      }
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
