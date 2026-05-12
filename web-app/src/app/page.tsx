"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Bot, User, Scale, RefreshCcw, X, Moon, Sun, Type, SpellCheck } from 'lucide-react';
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
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xl'>('normal');
  const [isDyslexic, setIsDyslexic] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const md = useMemo(() => new MarkdownIt({ html: true, linkify: true, breaks: true }), []);

  useEffect(() => {
    // Theme initialization
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.body.classList.add('dark-mode');
    }

    // Accessibility initialization
    const savedFontSize = localStorage.getItem('fontSize');
    if (savedFontSize) setFontSize(savedFontSize as any);

    const savedDyslexic = localStorage.getItem('isDyslexic');
    if (savedDyslexic === 'true') setIsDyslexic(true);

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

  // Update localStorage when settings change
  useEffect(() => {
    localStorage.setItem('fontSize', fontSize);
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem('isDyslexic', isDyslexic.toString());
  }, [isDyslexic]);

  // Keyboard Navigation
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!lawModalOpen) return;

      if (e.key === 'Escape') setLawModalOpen(false);
      if (e.key === 'l' || e.key === 'L') setModalLang(prev => prev === 'english' ? 'nepali' : 'english');

      // J/K Navigation between sections
      if (e.key === 'j' || e.key === 'k') {
        const sections = Array.from(document.querySelectorAll('.law-section'));
        const currentIdx = sections.findIndex(s => s.classList.contains('highlight-section'));
        let nextIdx = currentIdx;

        if (e.key === 'j') nextIdx = Math.min(sections.length - 1, currentIdx + 1);
        if (e.key === 'k') nextIdx = Math.max(0, currentIdx - 1);

        const nextSection = sections[nextIdx];
        if (nextSection) {
          const id = nextSection.id.replace('section-', '');
          setSelectedSectionId(id);
          nextSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [lawModalOpen]);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }
  };

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
      let response: Response | null = null;
      let success = false;
      let attempt = 0;
      const maxRetries = 2;

      while (attempt <= maxRetries && !success) {
        try {
          if (attempt > 0) {
            // Update message bubble to show retry status
            setMessages(prev => prev.map(msg =>
              msg.id === aiMessageId ? { ...msg, text: `⏳ *Google's API is busy. Retrying your request (Attempt ${attempt}/${maxRetries})...*` } : msg
            ));
            // Wait with exponential backoff before retrying (e.g., 2s, 4s)
            await new Promise(resolve => setTimeout(resolve, attempt * 2000));
          } else {
            // Clear message text initially to let typing-indicator show
            setMessages(prev => prev.map(msg =>
              msg.id === aiMessageId ? { ...msg, text: '' } : msg
            ));
          }

          // If the first attempt takes more than 6 seconds, show a reassuring message
          const takingAWhileTimeout = setTimeout(() => {
            setMessages(prev => prev.map(msg =>
              msg.id === aiMessageId && msg.text === '' ? { ...msg, text: '⏳ *Analyzing laws, this is taking a bit longer than usual...*' } : msg
            ));
          }, 6000);

          response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: input }),
          });

          clearTimeout(takingAWhileTimeout);

          if (!response.ok) {
            // Try to parse error details from the backend response JSON
            const errData = await response.json().catch(() => null);
            const errMsg = errData?.error || `HTTP error ${response.status}`;
            throw new Error(errMsg);
          }

          success = true;
        } catch (error: any) {
          console.warn(`[Gemini-Chat] Attempt ${attempt + 1} failed:`, error.message);
          const is503 = error.message?.includes('503') || error.message?.toLowerCase().includes('demand') || error.message?.toLowerCase().includes('service unavailable');

          if (is503 && attempt < maxRetries) {
            attempt++;
          } else {
            throw error;
          }
        }
      }

      if (!response) throw new Error('No response received');

      // Clear the loading/retry text before streaming the response
      setMessages(prev => prev.map(msg =>
        msg.id === aiMessageId ? { ...msg, text: '' } : msg
      ));

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let aiText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          aiText += chunk;

          // Slow down the typing effect a bit
          await new Promise(resolve => setTimeout(resolve, 30));

          setMessages(prev => prev.map(msg =>
            msg.id === aiMessageId ? { ...msg, text: aiText } : msg
          ));
        }
      }
    } catch (error: any) {
      console.error('Chat error:', error);
      let userFriendlyText = 'Sorry, I encountered an error. Please try again later.';

      const is503 = error.message?.includes('503') || error.message?.toLowerCase().includes('demand') || error.message?.toLowerCase().includes('service unavailable');
      if (is503) {
        userFriendlyText = '⚠️ **The Gemini API is currently experiencing extremely high demand (503 Service Unavailable).**\n\nGoogle\'s servers are temporarily out of capacity to process this request. Spikes in demand are usually temporary. Please wait a few seconds and try resending your message!';
      } else if (error.message) {
        userFriendlyText = `⚠️ **Sorry, I encountered an error:** ${error.message}`;
      }

      setMessages(prev => prev.map(msg =>
        msg.id === aiMessageId ? { ...msg, text: userFriendlyText } : msg
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

        return (
          <button
            key={index}
            className="reference-pill"
            onClick={() => openLawModal(fullId)}
            title={`View citation: ${displayId}`}
            aria-label={`View legislative reference ${displayId}`}
          >
            {displayId}
          </button>
        );
      }

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
    <main suppressHydrationWarning className={`${isDarkMode ? 'dark-mode' : ''} ${isDyslexic ? 'dyslexic-mode' : ''} font-size-${fontSize}`}>
      <header className="header" role="banner">
        <div className="logo">
          <Scale size={24} aria-hidden="true" />
          <span>Nepal Law Assistant</span>
        </div>
        <div className="header-actions">
          <div className="a11y-controls-header" role="toolbar" aria-label="Accessibility options">
            <div className="a11y-group">
              <button className={`a11y-btn ${fontSize === 'normal' ? 'active' : ''}`} onClick={() => setFontSize('normal')} aria-label="Normal font size">A</button>
              <button className={`a11y-btn ${fontSize === 'large' ? 'active' : ''}`} onClick={() => setFontSize('large')} aria-label="Large font size">A+</button>
              <button className={`a11y-btn ${fontSize === 'xl' ? 'active' : ''}`} onClick={() => setFontSize('xl')} aria-label="Extra large font size">A++</button>
            </div>
            <div className="a11y-group">
              <button
                className={`a11y-btn ${isDyslexic ? 'active' : ''}`}
                onClick={() => setIsDyslexic(!isDyslexic)}
                title="Dyslexia-friendly font"
                aria-label="Toggle dyslexia-friendly font"
              >
                <SpellCheck size={18} />
              </button>
            </div>
          </div>

          <button
            className="icon-btn"
            onClick={toggleDarkMode}
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Night Mode"}
            aria-label={isDarkMode ? "Switch to Light Mode" : "Switch to Night Mode"}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            className="reset-btn"
            onClick={() => window.location.reload()}
            aria-label="Reset chat session"
          >
            <RefreshCcw size={16} aria-hidden="true" />
            <span>Reset</span>
          </button>
        </div>
      </header>

      <div className="scroll-area" role="log" aria-live="polite">
        <div className="chat-container">
          {messages.map((msg) => (
            <div key={msg.id} className={`message ${msg.role}`} role="article">
              <div className="avatar" aria-hidden="true">
                {msg.role === 'ai' ? <Bot size={20} /> : <User size={20} />}
              </div>
              <div className="message-bubble">
                <div className="markdown-body">
                  {msg.text ? renderMessageText(msg.text) : (msg.role === 'ai' && isLoading && (
                    <div className="typing-indicator" aria-label="Assistant is typing">
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

      <div className="input-container" role="form">
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
            placeholder="Type your question..."
            rows={1}
            disabled={isLoading}
            aria-label="Legal question input"
            suppressHydrationWarning={true}
          />
          <button
            onClick={() => handleSubmit()}
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
          >
            <Send size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      {lawModalOpen && (
        <div className="modal-overlay" onClick={() => setLawModalOpen(false)} role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header-sticky">
              <div className="modal-header-top">
                <div className="title-area">
                  <span className="subtitle">Nepal Law Document</span>
                  <h2 id="modal-title">{currentLaw ? currentLaw.actName : 'Law Details'}</h2>
                </div>
                <button
                  className="close-btn"
                  onClick={() => setLawModalOpen(false)}
                  aria-label="Close document viewer"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="modal-controls">
                <div className="language-toggle" role="tablist">
                  <button
                    role="tab"
                    aria-selected={modalLang === 'english'}
                    className={modalLang === 'english' ? 'active' : ''}
                    onClick={() => setModalLang('english')}
                    aria-label="View in English"
                  >
                    English
                  </button>
                  <button
                    role="tab"
                    aria-selected={modalLang === 'nepali'}
                    className={modalLang === 'nepali' ? 'active' : ''}
                    onClick={() => setModalLang('nepali')}
                    aria-label="नेपालीमा हेर्नुहोस्"
                  >
                    नेपाली
                  </button>
                </div>

                {currentLaw && (
                  <button
                    className="view-toggle-btn-small"
                    onClick={() => setShowFullAct(!showFullAct)}
                    aria-pressed={showFullAct}
                  >
                    {showFullAct ? 'Exit Full View' : 'View Full Act'}
                  </button>
                )}
              </div>

              <div className="act-info-banner-sticky">
                <p>Reference from <strong>{currentLaw?.actName} ({currentLaw?.year})</strong></p>
                {showFullAct && <span className="view-badge">Full Act View</span>}
              </div>
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
                            lang={modalLang === 'nepali' ? 'ne' : 'en'}
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
