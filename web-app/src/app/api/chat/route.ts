import { NextRequest, NextResponse } from 'next/server';
import { searchKnowledgeBase } from '@/lib/retrieval';
import { getChatResponse } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // 1. Retrieve relevant law sections
    const searchResults = await searchKnowledgeBase(message, 5, true);
    const context = searchResults.map(r => 
      `ID: ${r.actId}#${r.sectionId}\nAct: ${r.actName} (${r.year})\nSection: ${r.title}\nContent: ${r.content}`
    ).join('\n\n---\n\n');

    // 2. Get streaming response from Gemini
    const stream = await getChatResponse(message, context);

    // 3. Create a ReadableStream to stream the response to the client
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const chunkText = chunk.text();
          controller.enqueue(encoder.encode(chunkText));
        }
        controller.close();
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
