import { useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import './App.css';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

const VERDICT_STYLES = {
  PASS: 'badge-pass',
  WARN: 'badge-warn',
  FAIL: 'badge-fail',
};

const parseReview = (text) => {
  const safeText = text || '';

  const verdictMatch = safeText.match(/VERDICT:\s*(PASS|WARN|FAIL)\b/i);
  const scoreMatch = safeText.match(/SCORE:\s*(\d+)\b/i);

  const sectionRegex = /##\s*(Bugs|Security|Performance|Style|Refactored Code)\s*\n([\s\S]*?)(?=\n##\s*(?:Bugs|Security|Performance|Style|Refactored Code)|$)/gi;
  const sectionMap = {
    Bugs: 'No issues listed.',
    Security: 'No issues listed.',
    Performance: 'No issues listed.',
    Style: 'No issues listed.',
    'Refactored Code': 'No refactored code provided.',
  };

  let sectionCount = 0;

  let match = sectionRegex.exec(safeText);
  while (match) {
    sectionMap[match[1]] = match[2].trim() || sectionMap[match[1]];
    sectionCount += 1;
    match = sectionRegex.exec(safeText);
  }

  return {
    verdict: verdictMatch?.[1]?.toUpperCase() || null,
    score: scoreMatch?.[1] ? parseInt(scoreMatch[1], 10) : null,
    sections: sectionMap,
    hasStructuredSections: sectionCount > 0,
    isFallback: /\[note:\s*ai formatter fallback was used\.|unable to generate refactored code/i.test(safeText),
  };
};

const parseSectionContent = (content) => {
  const safeContent = (content || '').trim();
  const codeBlocks = [];

  const withoutCode = safeContent.replace(/```([a-zA-Z0-9_-]*)\s*\n?([\s\S]*?)```/g, (_, lang, code) => {
    codeBlocks.push({
      language: (lang || 'code').trim() || 'code',
      code: (code || '').trim(),
    });
    return '';
  });

  const lines = withoutCode
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const bullets = [];
  const notes = [];

  lines.forEach((line) => {
    const bulletMatch = line.match(/^[-*+]\s+(.*)$/);
    if (bulletMatch) {
      bullets.push(bulletMatch[1]);
      return;
    }

    if (line) notes.push(line);
  });

  return { bullets, notes, codeBlocks };
};

const parseRawReview = (text) => {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const sections = [];
  let currentSection = null;

  lines.forEach((line) => {
    const isHeading = line.match(/^##\s+(.+)$/);
    const isKeyword = /VERDICT|SCORE/.test(line);
    const isBullet = /^[-*+]\s/.test(line);

    if (isHeading) {
      if (currentSection) sections.push(currentSection);
      currentSection = { title: isHeading[1], items: [] };
    } else if (isBullet && currentSection) {
      currentSection.items.push(line.replace(/^[-*+]\s+/, ''));
    } else if (isKeyword && !currentSection) {
      sections.push({ title: null, items: [line] });
    } else if (currentSection && line) {
      currentSection.items.push(line);
    }
  });

  if (currentSection) sections.push(currentSection);
  return sections;
};

function App() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const codeRef = useRef('');
  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);
  const [reviewRaw, setReviewRaw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const containerRef = useRef(null);

  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from('.navbar', { y: -50, opacity: 0, duration: 0.6, ease: 'power3.out' })
      .from('.workspace-header', { y: 20, opacity: 0, duration: 0.5, ease: 'power2.out' }, '-=0.3')
      .from('.panel', { y: 30, opacity: 0, duration: 0.5, stagger: 0.15, ease: 'power2.out' }, '-=0.3');
  }, { scope: containerRef });

  const handleScroll = () => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const lineCount = Math.max(1, code.split('\n').length);
  const lines = Array.from({ length: lineCount }, (_, i) => i + 1);

  const parsed = parseReview(reviewRaw);
  const isLiveAi = Boolean(parsed.verdict) && !parsed.isFallback;
  const refactoredParsed = parseSectionContent(parsed.sections['Refactored Code']);

  const handleCopyRefactored = async () => {
    const joinedCode = refactoredParsed.codeBlocks
      .map((block) => block.code)
      .filter(Boolean)
      .join('\n\n');

    if (!joinedCode) {
      setCopyStatus('Nothing to copy.');
      return;
    }

    try {
      await navigator.clipboard.writeText(joinedCode);
      setCopyStatus('Copied!');
      setTimeout(() => setCopyStatus(''), 1500);
    } catch {
      setCopyStatus('Copy failed.');
    }
  };

  const handleReview = async () => {
    const currentCode = (codeRef.current || code || '').trim();
    if (!currentCode) {
      setError('Please paste code before requesting a review.');
      return;
    }

    setLoading(true);
    setError('');
    setReviewRaw('');

    try {
      const response = await axios.post(`${API_BASE_URL}/ai/ai-review`, {
        code: currentCode,
      });

      const reviewText = response.data.review || response.data;
      setReviewRaw(
        typeof reviewText === 'string' ? reviewText : JSON.stringify(reviewText, null, 2),
      );
    } catch (err) {
      const backendMessage =
        err?.response?.data?.error || err?.response?.data?.details || err?.message;
      setError(backendMessage || 'Unable to fetch review right now.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div ref={containerRef} className="app-wrapper">
      <nav className="navbar">
        <div className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>CodeReviewer</div>
        <button className="nav-cta" onClick={() => navigate('/')}>
          <i className="ri-arrow-left-line"></i> Back to Home
        </button>
      </nav>

      <main className="app-shell">
        <div className="workspace-header">
          <h2>Your Workspace</h2>
          <p>Paste your code below to instantly find bugs, optimize performance, and get a refactored version.</p>
        </div>

      <section className="workspace-container">
        <div className="panel left-panel">
          <div className="input-header-row">
            <label htmlFor="code-input">Code Input</label>
            {code.length > 0 && (
              <button
                type="button"
                className="clear-code-btn"
                onClick={() => {
                  setCode('');
                  codeRef.current = '';
                }}
              >
                Clear
              </button>
            )}
          </div>

          <div className="editor-mockup workspace-editor">
            <div className="editor-header">
              <div className="dots">
                <span className="dot red"></span>
                <span className="dot yellow"></span>
                <span className="dot green"></span>
              </div>
              <div className="editor-tab">Drag and drop your code here</div>
            </div>
            <div className="editor-body-container">
              <div className="line-numbers" ref={lineNumbersRef}>
                {lines.map((line) => (
                  <div key={line} className="line-number">{line}</div>
                ))}
              </div>
              <textarea
                id="code-input"
                ref={textareaRef}
                value={code}
                onChange={(event) => {
                  const nextCode = event.target.value;
                  codeRef.current = nextCode;
                  setCode(nextCode);
                }}
                onScroll={handleScroll}
                className="code-input dark-editor"
                placeholder="Paste your code here..."
                spellCheck="false"
              />
            </div>
          </div>

          <div className="review-action">
            <button
              type="button"
              onClick={handleReview}
              disabled={loading}
              className="review-button"
            >
              {loading ? 'Reviewing...' : 'Review'}
            </button>
            {error && <p className="error-text">{error}</p>}
          </div>
        </div>

        <div className="panel right-panel">
          <div className="output-section review-section-container">
            <h2>Review Output</h2>

            <div className="summary-strip">
              <div className={`verdict-badge ${VERDICT_STYLES[parsed.verdict] || ''}`}>
                {parsed.verdict ? `Verdict: ${parsed.verdict}` : 'Verdict: -'}
              </div>
              <div className="score-pill">
                {parsed.score ? `Score: ${parsed.score}/100` : 'Score: -'}
              </div>
              {isLiveAi && <div className="live-pill">Live AI</div>}
              {parsed.isFallback && <div className="fallback-pill">Fallback Used</div>}
            </div>

            {parsed.hasStructuredSections ? (
              <div className="review-sections">
                {Object.entries(parsed.sections).map(([title, content]) => {
                  if (title === 'Refactored Code') return null;
                  const formatted = parseSectionContent(content);

                  return (
                    <details key={title} open className="review-section">
                      <summary>{title}</summary>
                      <div className="review-body">
                        {formatted.bullets.length > 0 && (
                          <ul className="review-list">
                            {formatted.bullets.map((item, index) => (
                              <li key={`${title}-bullet-${index}`}>{item}</li>
                            ))}
                          </ul>
                        )}

                        {formatted.notes.length > 0 && (
                          <div className="review-notes">
                            {formatted.notes.map((note, index) => (
                              <p key={`${title}-note-${index}`}>{note}</p>
                            ))}
                          </div>
                        )}

                        {formatted.codeBlocks.map((block, index) => (
                          <div key={`${title}-code-${index}`} className="review-code-block">
                            <div className="review-code-label">{block.language || 'code'}</div>
                            <pre className="review-output">{block.code}</pre>
                          </div>
                        ))}

                        {formatted.bullets.length === 0 &&
                          formatted.notes.length === 0 &&
                          formatted.codeBlocks.length === 0 && (
                            <p className="review-empty">No details provided for this section.</p>
                          )}
                      </div>
                    </details>
                  );
                })}
              </div>
            ) : reviewRaw ? (
              <div className="review-sections">
                {parseRawReview(reviewRaw).map((section, idx) => (
                  <details key={`raw-${idx}`} open className="review-section">
                    {section.title && section.title !== 'Refactored Code' ? (
                      <>
                        <summary>{section.title}</summary>
                        <div className="review-body">
                          {section.items.some((item) => /^VERDICT|^SCORE/.test(item)) ? (
                            <div className="review-notes">
                              {section.items.map((item, i) => (
                                <p key={`${idx}-${i}`} className="highlight-key">
                                  {item}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <ul className="review-list">
                              {section.items.map((item, i) => (
                                <li key={`${idx}-${i}`}>{item}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </>
                    ) : section.title === null ? (
                      <>
                        <summary>Overview</summary>
                        <div className="review-body">
                          <div className="review-notes">
                            {section.items.map((item, i) => (
                              <p key={`${idx}-${i}`} className="highlight-key">
                                {item}
                              </p>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : null}
                  </details>
                ))}
              </div>
            ) : (
              <div className="review-sections">
                <p className="empty-note">No review content yet.</p>
              </div>
            )}
          </div>

          {parsed.verdict && parsed.sections['Refactored Code'] && (
            <div className="output-section code-output-container">
              <h2>Refactored Code Output</h2>
              <div className="code-output-toolbar">
                <button type="button" className="copy-button" onClick={handleCopyRefactored}>
                  Copy Refactored Code
                </button>
                {copyStatus && <span className="copy-status">{copyStatus}</span>}
              </div>
              <p className="output-note">
                {parsed.verdict === 'PASS'
                  ? 'Code is correct. Review the suggestions above.'
                  : parsed.verdict === 'WARN'
                    ? 'Code needs improvements. See refactored version below.'
                    : 'Code has issues. Refactored version below addresses critical problems.'}
              </p>
              <div className="refactored-code-display">
                {refactoredParsed.codeBlocks.length > 0 ? (
                  refactoredParsed.codeBlocks.map((block, index) => (
                    <div key={`refactored-${index}`} className="code-output-block">
                      <div className="code-output-label">{block.language}</div>
                      <pre className="code-output-content">{block.code}</pre>
                    </div>
                  ))
                ) : (
                  <p className="output-note">No refactored code provided.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
    </div>
  );
}

export default App;