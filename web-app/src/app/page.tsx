"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Bot, User, Scale, RefreshCcw, X, Languages } from 'lucide-react';
import MarkdownIt from 'markdown-it';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  references?: string[];
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'ai',
      text: "नमस्ते! I am your Nepal Law Assistant. How can I help you understand Nepal's laws today?\n\nतपाईं मलाई नेपाली वा अंग्रेजीमा प्रश्न सोध्न सक्नुहुन्छ।"
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLawId, setSelectedLawId] = useState<string | null>(null);
  const [lawModalOpen, setLawModalOpen] = useState(false);
  const [modalLang, setModalLang] = useState<'english' | 'nepali'>('english');
  const [knowledgeBase, setKnowledgeBase] = useState<any[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const md = useMemo(() => new MarkdownIt({ html: true, linkify: true, breaks: true }), []);

  useEffect(() => {
    fetch('/knowledge_base.json')
      .then(res => res.json())
      .then(data => setKnowledgeBase(data))
      .catch(err => console.error('Failed to load knowledge base:', err));
  }, []);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const aiMessageId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: aiMessageId, role: 'ai', text: '' }]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });

      if (!response.ok) throw new Error('Failed to fetch response');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let aiText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          aiText += chunk;
          
          setMessages(prev => prev.map(msg => 
            msg.id === aiMessageId ? { ...msg, text: aiText } : msg
          ));
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId ? { ...msg, text: 'Sorry, I encountered an error. Please try again later.' } : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const openLawModal = (lawId: string) => {
    setSelectedLawId(lawId);
    setLawModalOpen(true);
    if (lawId.includes('nepali')) setModalLang('nepali');
    else setModalLang('english');
  };

  const renderMessageText = (text: string) => {
    const parts = text.split(/(\[Ref: [a-zA-Z0-9_]+\])/g);
    return parts.map((part, index) => {
      const match = part.match(/\[Ref: ([a-zA-Z0-9_]+)\]/);
      if (match) {
        const lawId = match[1];
        const displayId = lawId.replace(/_/g, ' ').toUpperCase();
        return (
          <button 
            key={index} 
            className="reference-pill"
            onClick={() => openLawModal(lawId)}
          >
            {displayId}
          </button>
        );
      }
      return <div key={index} dangerouslySetInnerHTML={{ __html: md.render(part) }} />;
    });
  };

  const currentLaw = knowledgeBase.find(l => {
    if (!selectedLawId) return false;
    const baseId = selectedLawId.replace('_english', '').replace('_nepali', '');
    const currentBaseId = l.id.replace('_english', '').replace('_nepali', '');
    return baseId === currentBaseId && l.language === modalLang;
  }) || knowledgeBase.find(l => l.id === selectedLawId);

  return (
    <main suppressHydrationWarning>
      <header className="header">
        <div className="logo">
          <Scale size={24} />
          <span>Nepal Law Assistant</span>
        </div>
        <button className="reset-btn" onClick={() => window.location.reload()}>
          <RefreshCcw size={16} />
          <span>Reset Chat</span>
        </button>
      </header>

      <div className="scroll-area">
        <div className="chat-container">
          {messages.map((msg) => (
            <div key={msg.id} className={`message ${msg.role}`}>
              <div className="avatar">
                {msg.role === 'ai' ? <Bot size={20} /> : <User size={20} />}
              </div>
              <div className="message-bubble">
                <div className="markdown-body">
                  {msg.text ? renderMessageText(msg.text) : (msg.role === 'ai' && isLoading && (
                    <div className="typing-indicator">
                      <span></span><span></span><span></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      </div>

      <div className="input-container">
        <div className="input-wrapper">
          <textarea
            ref={textAreaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type your question... (Shift+Enter for new line)"
            rows={1}
            disabled={isLoading}
            suppressHydrationWarning
          />
          <button onClick={() => handleSubmit()} disabled={!input.trim() || isLoading}>
            <Send size={20} />
          </button>
        </div>
      </div>

      {lawModalOpen && currentLaw && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <div className="modal-title">
                <h2>{currentLaw.actName} ({currentLaw.year})</h2>
                <div className="lang-switcher">
                  <button 
                    className={modalLang === 'english' ? 'active' : ''} 
                    onClick={() => setModalLang('english')}
                  >
                    English
                  </button>
                  <button 
                    className={modalLang === 'nepali' ? 'active' : ''} 
                    onClick={() => setModalLang('nepali')}
                  >
                    नेपाली
                  </button>
                </div>
              </div>
              <button className="close-modal" onClick={() => setLawModalOpen(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              {currentLaw.sections.map((sec: any, i: number) => (
                <div key={i} className="law-section">
                  <h3>{sec.title}</h3>
                  <div dangerouslySetInnerHTML={{ __html: md.render(sec.content) }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
