"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Bot, User, Scale, RefreshCcw, X } from 'lucide-react';
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
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [showFullAct, setShowFullAct] = useState(false);
  const [lawModalOpen, setLawModalOpen] = useState(false);
  const [modalLang, setModalLang] = useState<'english' | 'nepali'>('english');
  const [knowledgeBase, setKnowledgeBase] = useState<any[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const md = useMemo(() => new MarkdownIt({ html: true, linkify: true, breaks: true }), []);

  useEffect(() => {
    // Attempt to load the knowledge base for the modal
    fetch('/api/knowledge')
      .then(res => {
        if (!res.ok) throw new Error('Knowledge base not found');
        return res.json();
      })
      .then(data => {
        if (data.error) throw new Error(data.error);
        setKnowledgeBase(data);
      })
      .catch(err => {
        console.error('Failed to load knowledge base:', err);
      });
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

    // Reset textarea height
    if (textAreaRef.current) textAreaRef.current.style.height = 'auto';

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

  const openLawModal = (idString: string) => {
    // idString format: "act_id#section_id"
    const [actId, sectionId] = idString.split('#');
    setSelectedLawId(actId);
    setSelectedSectionId(sectionId || null);
    setShowFullAct(false); // Reset to focused view
    setLawModalOpen(true);
    
    // Auto-scroll to section after modal opens
    setTimeout(() => {
      const element = document.getElementById(`section-${sectionId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 300);
  };

  const renderMessageText = (text: string) => {
    // Catching [Ref: id] or [Ref: id - details]
    const parts = text.split(/(\[Ref:\s*[^\]]+\])/gi);

    return parts.map((part, index) => {
      const match = part.match(/\[Ref:\s*([a-zA-Z0-9_#]+)/i);
      if (match) {
        const fullId = match[1].toLowerCase();
        const displayId = part.replace(/\[Ref:\s*/i, '').replace(']', '').trim().toUpperCase();

        console.log('Detected reference:', { fullId, displayId, original: part });

        return (
          <button
            key={index}
            className="reference-pill"
            onClick={() => {
              console.log('Clicking pill for:', fullId);
              openLawModal(fullId);
            }}
            title={`Click to view: ${displayId}`}
          >
            {displayId}
          </button>
        );
      }

      // Only render markdown if it's not empty
      if (!part.trim()) return null;

      return (
        <div
          key={index}
          className="markdown-part"
          style={{ display: 'inline' }}
          dangerouslySetInnerHTML={{ __html: md.render(part).replace(/^<p>|<\/p>$/g, '') }}
        />
      );
    });
  };

  const currentLaw = useMemo(() => {
    if (!selectedLawId || knowledgeBase.length === 0) return null;
    return knowledgeBase.find(l => l.id === selectedLawId) || null;
  }, [selectedLawId, knowledgeBase]);

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

      {lawModalOpen && (
        <div className="modal-overlay" onClick={() => setLawModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header-sticky">
              <div className="modal-header-top">
                <div className="title-area">
                  <span className="subtitle">Nepal Law Document</span>
                  <h2>{currentLaw ? currentLaw.actName : 'Law Details'}</h2>
                </div>
                <button className="close-btn" onClick={() => setLawModalOpen(false)}>×</button>
              </div>
              
              <div className="modal-controls">
                <div className="language-toggle">
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
                
                {currentLaw && (
                  <button 
                    className="view-toggle-btn-small"
                    onClick={() => setShowFullAct(!showFullAct)}
                  >
                    {showFullAct ? 'Exit Full View' : 'View Full Act'}
                  </button>
                )}
              </div>

              {currentLaw && (
                <div className="act-info-banner-sticky">
                  <p>Reference from <strong>{currentLaw.actName} ({currentLaw.year})</strong></p>
                  {showFullAct && <span className="view-badge">Full Act View</span>}
                </div>
              )}
            </div>

            <div className="modal-body">
              {knowledgeBase.length === 0 ? (
                <div className="loading-state">Loading knowledge base...</div>
              ) : currentLaw ? (
                <div className="law-content">
                  {(currentLaw.sections || []).length > 0 ? (
                    currentLaw.sections
                      .filter((sec: any) => showFullAct || !selectedSectionId || sec.id === selectedSectionId || sec.id === `sec_${selectedSectionId?.replace('section_', '')}`)
                      .map((sec: any) => {
                        const langData = sec[modalLang];
                        const isHighlighted = sec.id === selectedSectionId || sec.id === `sec_${selectedSectionId?.replace('section_', '')}`;
                        
                        if (!langData && !showFullAct) return null;
                        
                        return (
                          <div 
                            key={sec.id} 
                            id={`section-${sec.id}`} 
                            className={`law-section ${isHighlighted ? 'highlight-section' : ''}`}
                          >
                            <div className="section-header">
                              <h3>{langData?.title || `${sec.id.toUpperCase()} (Translation missing)`}</h3>
                              {isHighlighted && <span className="cited-tag">Cited</span>}
                            </div>
                            {langData ? (
                              <div className="section-body" dangerouslySetInnerHTML={{ __html: md.render(langData.content) }} />
                            ) : (
                              <p className="text-muted italic">Content not available in {modalLang === 'english' ? 'English' : 'नेपाली'}.</p>
                            )}
                          </div>
                        );
                      })
                  ) : (
                    <div className="error-state">No sections found for this law.</div>
                  )}
                </div>
              ) : (
                <div className="error-state">Law ID "{selectedLawId}" not found.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
