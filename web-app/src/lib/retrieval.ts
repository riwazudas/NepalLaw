import fs from 'fs';
import path from 'path';
import { model } from './gemini';

export interface SearchResult {
  actId: string;
  sectionId: string;
  actName: string;
  year: string;
  title: string;
  content: string;
  language: string;
  score: number;
  explanation?: string;
}

const BILINGUAL_GLOSSARY: Record<string, string> = {
  'constitution': 'संविधान',
  'संविधान': 'constitution',
  'arbitration': 'मध्यस्थता',
  'मध्यस्थता': 'arbitration',
  'arbitrator': 'मध्यस्थ',
  'मध्यस्थ': 'arbitrator',
  'contract': 'करार',
  'करार': 'contract',
  'court': 'अदालत',
  'अदालत': 'court',
  'district court': 'जिल्ला अदालत',
  'supreme court': 'सर्वोच्च अदालत',
  'appellate court': 'पुनरावेदन अदालत',
  'company': 'कम्पनी',
  'कम्पनी': 'company',
  'audit': 'लेखापरीक्षण',
  'लेखापरीक्षण': 'audit',
  'bonus': 'बोनस',
  'बोनस': 'bonus',
  'banking': 'बैंकिङ्ग',
  'बैंकिङ्ग': 'banking',
  'offence': 'कसूर',
  'कसूर': 'offence',
  'insurance': 'बीमा',
  'बीमा': 'insurance',
  'tax': 'कर',
  'कर': 'tax',
  'income': 'आय',
  'आय': 'income',
  'labour': 'श्रम',
  'labor': 'श्रम',
  'श्रम': 'labour',
  'foreign': 'विदेशी',
  'exchange': 'विनिमय',
  'cooperative': 'सहकारी',
  'सहकारी': 'cooperative',
  'security': 'धितोपत्र',
  'securities': 'धितोपत्र',
  'insolvency': 'दामासाही',
  'दामासाही': 'insolvency',
  'procurement': 'खरिद',
  'खरिद': 'procurement',
  'ecommerce': 'ईकमर्स',
  'immigration': 'अध्यागमन',
  'अध्यागमन': 'immigration',
  'social': 'सामाजिक',
  'सामाजिक': 'social',
  'preamble': 'प्रस्तावना',
  'प्रस्तावना': 'preamble'
};

const STOP_WORDS = new Set([
  'the', 'and', 'a', 'of', 'to', 'in', 'is', 'that', 'it', 'for', 'on', 'with', 'as', 'at', 'by', 'an', 'be', 'this', 'are', 'from',
  'र', 'को', 'का', 'मा', 'ले', 'लागि', 'द्वारा', 'तथा', 'पनि', 'छ', 'छन्', 'हुनेछ', 'गर्नु', 'गर्ने', 'भएको', 'एक', 'यो', 'हो'
]);

export async function searchKnowledgeBase(
  query: string, 
  limit: number = 5, 
  useReRanking: boolean = false
): Promise<SearchResult[]> {
  const kbPath = path.join(process.cwd(), 'public/knowledge_base.json');
  if (!fs.existsSync(kbPath)) {
    console.error('Knowledge base file not found at:', kbPath);
    return [];
  }
  
  const knowledgeBase = JSON.parse(fs.readFileSync(kbPath, 'utf-8'));
  const results: SearchResult[] = [];
  
  // 1. Language Detection & Query Expansion
  const isNepaliQuery = /[\u0900-\u097F]/.test(query);
  const targetLang = isNepaliQuery ? 'nepali' : 'english';
  
  // Tokenize query
  const queryTerms = query
    .toLowerCase()
    .replace(/[.,:;?!()"\-\u0964]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));
    
  // Bilingual query expansion
  const expandedTerms = [...queryTerms];
  for (const term of queryTerms) {
    if (BILINGUAL_GLOSSARY[term]) {
      expandedTerms.push(BILINGUAL_GLOSSARY[term].toLowerCase());
    }
  }

  // Deduplicate query terms
  const uniqueQueryTerms = Array.from(new Set(expandedTerms));
  if (uniqueQueryTerms.length === 0) {
    return [];
  }

  // 2. Index Calculation & TF-IDF Scoring
  const documents: { law: any; section: any; matchedLang: string; text: string; title: string }[] = [];
  
  for (const law of (knowledgeBase as any)) {
    for (const section of law.sections) {
      if (section.english) {
        documents.push({
          law,
          section,
          matchedLang: 'english',
          title: section.english.title.toLowerCase(),
          text: (section.english.title + ' ' + section.english.content).toLowerCase()
        });
      }
      if (section.nepali) {
        documents.push({
          law,
          section,
          matchedLang: 'nepali',
          title: section.nepali.title.toLowerCase(),
          text: (section.nepali.title + ' ' + section.nepali.content).toLowerCase()
        });
      }
    }
  }

  const N = documents.length;
  
  // Compute Document Frequency (DF) for query terms
  const dfMap: Record<string, number> = {};
  for (const term of uniqueQueryTerms) {
    let df = 0;
    for (const doc of documents) {
      if (doc.text.includes(term)) {
        df++;
      }
    }
    dfMap[term] = df;
  }

  // Compute retrieval score for each document
  const docScores = documents.map(doc => {
    let score = 0;
    const termFrequencies: Record<string, number> = {};
    
    // Count raw frequencies
    for (const term of uniqueQueryTerms) {
      if (doc.text.includes(term)) {
        // Simple term counting
        const occurrences = (doc.text.match(new RegExp(escapeRegExp(term), 'g')) || []).length;
        termFrequencies[term] = occurrences;
      }
    }

    for (const term of uniqueQueryTerms) {
      const tf = termFrequencies[term] || 0;
      if (tf > 0) {
        const df = dfMap[term] || 0;
        // BM25-like IDF
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        // Soft TF scaling
        const tfScaled = tf / (tf + 1.5 + 1.2 * 1.0); // Simple length norm approximation
        
        let termScore = tfScaled * idf;
        
        // Title Match Boost (3x multiplier)
        if (doc.title.includes(term)) {
          termScore *= 3.0;
        }
        
        // Act Name Boost: if query terms match words in the Act ID/Name (e.g., "companies" matches Companies Act sections)
        if (doc.law.actName.toLowerCase().includes(term) || doc.law.id.toLowerCase().includes(term)) {
          termScore *= 2.5;
        }

        score += termScore;
      }
    }

    // Boost score if the document matches the user's input language
    if (doc.matchedLang === targetLang) {
      score *= 1.2;
    }

    return { doc, score };
  });

  // Filter out zero scores and sort
  const scoredCandidates = docScores
    .filter(cs => cs.score > 0)
    .sort((a, b) => b.score - a.score);

  // Map to SearchResult interface
  const rawResults: SearchResult[] = scoredCandidates.map(cs => {
    const { doc, score } = cs;
    const bestData = doc.section[doc.matchedLang];
    return {
      actId: doc.law.id,
      sectionId: doc.section.id,
      actName: doc.law.actName,
      year: doc.law.year,
      title: bestData.title,
      content: bestData.content,
      language: doc.matchedLang,
      score: Math.round(score * 10) / 10 // Round to 1 decimal place
    };
  });

  // Deduplicate results so same section from the same act isn't returned twice in both languages (prioritize targetLang)
  const uniqueResults: SearchResult[] = [];
  const seenIds = new Set<string>();
  
  for (const res of rawResults) {
    const key = `${res.actId}#${res.sectionId}`;
    if (!seenIds.has(key)) {
      seenIds.add(key);
      uniqueResults.push(res);
    } else if (res.language === targetLang) {
      // If we see it again and this one matches our target language, replace the other language match
      const existingIdx = uniqueResults.findIndex(r => `${r.actId}#${r.sectionId}` === key);
      if (existingIdx !== -1) {
        uniqueResults[existingIdx] = res;
      }
    }
  }

  // 3. Optional Gemini Contextual Re-ranking
  if (useReRanking && uniqueResults.length > 0 && process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const topCandidates = uniqueResults.slice(0, 15);
    try {
      const candidatesText = topCandidates.map((c, idx) => 
        `Index: ${idx}\nAct: ${c.actName} (${c.year})\nSection: ${c.title}\nSnippet: ${c.content.substring(0, 350)}...`
      ).join('\n---\n');

      const rankPrompt = `You are an expert legislative search re-ranker. Analyze the user's legal query and re-rank the following document chunks based on their absolute semantic relevance to answering the query.

Query: "${query}"

Candidates:
${candidatesText}

Instructions:
1. Select the top 5 most relevant candidates that contain accurate legal basis to address the query.
2. Provide a relevance score between 0.0 and 1.0 for each of the top 5 (higher is more relevant).
3. For each selected candidate, write a concise 1-sentence explanation of why it is relevant to the query.
4. Return the results STRICTLY as a JSON array of objects with fields: "index" (number), "relevance_score" (number), and "explanation" (string). Do not add any backticks, markdown, or text besides the valid JSON array.

Response format (STRICTLY VALID JSON ARRAY ONLY):
[
  { "index": 0, "relevance_score": 0.95, "explanation": "This section defines the qualifications of an arbitrator, addressing the query directly." },
  ...
]`;

      const rankResult = await model.generateContent(rankPrompt);
      const textResponse = rankResult.response.text();
      
      // Clean potential code block wraps
      const cleanJson = textResponse.replace(/```json|```/g, '').trim();
      const rankings = JSON.parse(cleanJson);
      
      if (Array.isArray(rankings) && rankings.length > 0) {
        const rankedResults: SearchResult[] = [];
        const addedKeys = new Set<string>();

        for (const rank of rankings) {
          const item = topCandidates[rank.index];
          if (item) {
            const key = `${item.actId}#${item.sectionId}`;
            addedKeys.add(key);
            rankedResults.push({
              ...item,
              score: Math.round(rank.relevance_score * 100), // Convert 0-1 scale to percentage
              explanation: rank.explanation
            });
          }
        }

        // Fill in remaining top items from the original list (by TF-IDF) up to the limit if fewer than limit are ranked
        for (const item of topCandidates) {
          const key = `${item.actId}#${item.sectionId}`;
          if (!addedKeys.has(key) && rankedResults.length < limit) {
            rankedResults.push(item);
          }
        }

        return rankedResults.slice(0, limit);
      }
    } catch (err) {
      console.error('Gemini re-ranking failed, falling back to pure TF-IDF ranking:', err);
    }
  }

  // Default fallback or when re-ranking is false
  return uniqueResults.slice(0, limit);
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
