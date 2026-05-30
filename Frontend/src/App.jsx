import { useRef, useState, useCallback, useEffect } from 'react';
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

// ─── Detect language from code blocks ───────────────────────────────────────
const SUPPORTED_LANGS = new Set([
  'python', 'py', 'py3', 'python2',
  'javascript', 'js', 'typescript', 'ts',
  'c', 'cpp', 'c++', 'java',
  'go', 'golang', 'rust', 'rs',
  'ruby', 'rb', 'php',
  'csharp', 'cs', 'c#',
  'kotlin', 'kt', 'swift',
  'bash', 'sh', 'dart',
  'scala', 'sc', 'lua',
  'perl', 'pl', 'r', 'rscript',
  'elixir', 'exs', 'haskell', 'hs',
  'zig', 'julia', 'jl',
]);

const detectLanguageFromBlocks = (codeBlocks, fallbackCode) => {
  for (const block of codeBlocks) {
    const lang = (block.language || '').toLowerCase().trim();
    if (lang && lang !== 'code' && lang !== 'text' && lang !== 'plaintext') return lang;
  }
  // Heuristic from code content
  const src = fallbackCode || '';
  if (/^\s*#include\s*<(iostream|string|vector|algorithm|map|set|queue)>/m.test(src) || /\bstd::/.test(src) || /\bcout\s*<</.test(src)) return 'cpp';
  if (/^\s*#include\s*<(stdio\.h|stdlib\.h|string\.h)>/m.test(src) || /\bprintf\s*\(/.test(src) || /\bscanf\s*\(/.test(src)) return 'c';
  if (/\bpublic\s+class\s+\w+/.test(src) || /\bSystem\.out\.print/.test(src) || /\bpublic\s+static\s+void\s+main/.test(src)) return 'java';
  if (/\bfunc\s+\w+\s*\(/.test(src) || /\bpackage\s+main\b/.test(src) || /\bfmt\.Print/.test(src)) return 'go';
  if (/\bfn\s+\w+\s*\(/.test(src) || /\bprintln!\s*\(/.test(src) || /\buse\s+std::/.test(src)) return 'rust';
  if (/^\s*def\s+\w+\s*\(|print\s*\(.*\)|^\s*import\s+\w+/m.test(src) && !(/\bval\b|\bvar\b/.test(src) && /\bfun\s/.test(src))) return 'python';
  if (/\binterface\b|\btype\s+\w+\s*=/.test(src) && /:\s*(string|number|boolean|any)\b/.test(src)) return 'typescript';
  if (/\bfunction\b|\bconst\b|\blet\b|\bconsole\.log\b|=>\s*\{/.test(src)) return 'javascript';
  if (/\becho\s+["'\w]|<\?php/.test(src)) return 'php';
  if (/\bfun\s+\w+\s*\(/.test(src) && /\bval\b|\bvar\b/.test(src)) return 'kotlin';
  if (/\bimport\s+\w+\s*\n[\s\S]*\bprintln\b/.test(src) || /^\s*@\w+/.test(src) && /\bSwift\b/.test(src)) return 'swift';
  if (/\bdef\s+\w+\s*do\b|IO\.puts\b|\bdefmodule\b/.test(src)) return 'elixir';
  if (/\bmain\s*::\s*IO\s*\(\)|^\s*import\s+Data\./m.test(src)) return 'haskell';
  if (/\bprint\s+["\w]|\bmy\s+\$\w+/.test(src)) return 'perl';
  if (/^\s*local\s+\w+\s*=|\bprint\s*\(/.test(src) && /\bend\b/.test(src)) return 'lua';
  if (/\bprintln!\s*\(/.test(src) && /\bconst\s+\w+\s*:/.test(src)) return 'zig';
  if (/^\s*println\s*\(/.test(src) && /\bjulia\b/i.test(src)) return 'julia';
  if (/\bcat\s*\(|<-\s*\w+|\bggplot\b/.test(src)) return 'r';
  return 'unknown';
};

// ─── Language display names ──────────────────────────────────────────────────
const LANG_DISPLAY = {
  python: 'Python', py: 'Python', py3: 'Python', python2: 'Python 2',
  javascript: 'JavaScript', js: 'JavaScript',
  typescript: 'TypeScript', ts: 'TypeScript',
  c: 'C', cpp: 'C++', 'c++': 'C++',
  java: 'Java',
  go: 'Go', golang: 'Go',
  rust: 'Rust', rs: 'Rust',
  ruby: 'Ruby', rb: 'Ruby',
  php: 'PHP',
  csharp: 'C#', cs: 'C#', 'c#': 'C#',
  kotlin: 'Kotlin', kt: 'Kotlin',
  swift: 'Swift',
  bash: 'Bash', sh: 'Bash',
  dart: 'Dart',
  scala: 'Scala', sc: 'Scala',
  lua: 'Lua',
  perl: 'Perl', pl: 'Perl',
  r: 'R', rscript: 'R',
  elixir: 'Elixir', exs: 'Elixir',
  haskell: 'Haskell', hs: 'Haskell',
  zig: 'Zig',
  julia: 'Julia', jl: 'Julia',
};

// ─── Piston API language map (versions from GET /api/v2/piston/runtimes) ─────
const PISTON_LANG_MAP = {
  // Python
  python:     { language: 'python',     version: '3.10.0',  filename: 'main.py'    },
  py:         { language: 'python',     version: '3.10.0',  filename: 'main.py'    },
  py3:        { language: 'python',     version: '3.10.0',  filename: 'main.py'    },
  python2:    { language: 'python2',    version: '2.7.18',  filename: 'main.py'    },
  // JavaScript (Node 18)
  javascript: { language: 'javascript', version: '18.15.0', filename: 'main.js'    },
  js:         { language: 'javascript', version: '18.15.0', filename: 'main.js'    },
  // TypeScript (Node runtime, ts-node)
  typescript: { language: 'typescript', version: '5.0.3',   filename: 'main.ts'    },
  ts:         { language: 'typescript', version: '5.0.3',   filename: 'main.ts'    },
  // C  (GCC 10.2.0)
  c:          { language: 'c',          version: '10.2.0',  filename: 'main.c'     },
  // C++ (GCC 10.2.0)
  cpp:        { language: 'c++',        version: '10.2.0',  filename: 'main.cpp'   },
  'c++':      { language: 'c++',        version: '10.2.0',  filename: 'main.cpp'   },
  // Java
  java:       { language: 'java',       version: '15.0.2',  filename: 'Main.java'  },
  // Go
  go:         { language: 'go',         version: '1.16.2',  filename: 'main.go'    },
  golang:     { language: 'go',         version: '1.16.2',  filename: 'main.go'    },
  // Rust (1.68.2 — latest on Piston)
  rust:       { language: 'rust',       version: '1.68.2',  filename: 'main.rs'    },
  rs:         { language: 'rust',       version: '1.68.2',  filename: 'main.rs'    },
  // Ruby
  ruby:       { language: 'ruby',       version: '3.0.1',   filename: 'main.rb'    },
  rb:         { language: 'ruby',       version: '3.0.1',   filename: 'main.rb'    },
  // PHP
  php:        { language: 'php',        version: '8.2.3',   filename: 'main.php'   },
  // C# (Mono runtime, 6.12.0)
  csharp:     { language: 'csharp',     version: '6.12.0',  filename: 'main.cs'    },
  cs:         { language: 'csharp',     version: '6.12.0',  filename: 'main.cs'    },
  'c#':       { language: 'csharp',     version: '6.12.0',  filename: 'main.cs'    },
  // Kotlin
  kotlin:     { language: 'kotlin',     version: '1.8.20',  filename: 'main.kt'    },
  kt:         { language: 'kotlin',     version: '1.8.20',  filename: 'main.kt'    },
  // Swift
  swift:      { language: 'swift',      version: '5.3.3',   filename: 'main.swift' },
  // Bash
  bash:       { language: 'bash',       version: '5.2.0',   filename: 'main.sh'    },
  sh:         { language: 'bash',       version: '5.2.0',   filename: 'main.sh'    },
  // Dart
  dart:       { language: 'dart',       version: '2.19.6',  filename: 'main.dart'  },
  // Scala
  scala:      { language: 'scala',      version: '3.2.2',   filename: 'main.scala' },
  sc:         { language: 'scala',      version: '3.2.2',   filename: 'main.scala' },
  // Lua
  lua:        { language: 'lua',        version: '5.4.4',   filename: 'main.lua'   },
  // Perl
  perl:       { language: 'perl',       version: '5.36.0',  filename: 'main.pl'    },
  pl:         { language: 'perl',       version: '5.36.0',  filename: 'main.pl'    },
  // R
  r:          { language: 'rscript',    version: '4.1.1',   filename: 'main.r'     },
  rscript:    { language: 'rscript',    version: '4.1.1',   filename: 'main.r'     },
  // Elixir
  elixir:     { language: 'elixir',     version: '1.11.3',  filename: 'main.exs'   },
  exs:        { language: 'elixir',     version: '1.11.3',  filename: 'main.exs'   },
  // Haskell
  haskell:    { language: 'haskell',    version: '9.0.1',   filename: 'main.hs'    },
  hs:         { language: 'haskell',    version: '9.0.1',   filename: 'main.hs'    },
  // Zig
  zig:        { language: 'zig',        version: '0.10.1',  filename: 'main.zig'   },
  // Julia
  julia:      { language: 'julia',      version: '1.8.5',   filename: 'main.jl'    },
  jl:         { language: 'julia',      version: '1.8.5',   filename: 'main.jl'    },
};

// ─── Auto-wrap bare snippets in boilerplate when needed ─────────────────────
const wrapCodeForExecution = (code, langKey) => {
  const src = (code || '').trim();
  const lang = (langKey || '').toLowerCase();

  // Java: wrap bare statements in Main class
  if (lang === 'java' && !/\bclass\s+\w+/.test(src)) {
    const indented = src.split('\n').map((l) => '        ' + l).join('\n');
    return `public class Main {\n    public static void main(String[] args) {\n${indented}\n    }\n}`;
  }

  // C: wrap bare statements in main()
  if (lang === 'c' && !/\bint\s+main\s*\(/.test(src) && !/^\s*#include/.test(src)) {
    return `#include <stdio.h>\n#include <stdlib.h>\n\nint main(void) {\n${src.split('\n').map((l) => '    ' + l).join('\n')}\n    return 0;\n}`;
  }

  // C++: wrap bare statements in main()
  if ((lang === 'cpp' || lang === 'c++') && !/\bint\s+main\s*\(/.test(src) && !/^\s*#include/.test(src)) {
    return `#include <iostream>\nusing namespace std;\n\nint main() {\n${src.split('\n').map((l) => '    ' + l).join('\n')}\n    return 0;\n}`;
  }

  // C# minimal: wrap bare code in a Program class
  if ((lang === 'csharp' || lang === 'cs' || lang === 'c#') && !/\bclass\s+\w+/.test(src) && !/^\s*using\s+System/.test(src)) {
    const indented = src.split('\n').map((l) => '        ' + l).join('\n');
    return `using System;\n\nclass Program {\n    static void Main() {\n${indented}\n    }\n}`;
  }

  // Kotlin: wrap in main function if not present
  if ((lang === 'kotlin' || lang === 'kt') && !/\bfun\s+main\s*\(/.test(src)) {
    const indented = src.split('\n').map((l) => '    ' + l).join('\n');
    return `fun main() {\n${indented}\n}`;
  }

  // Rust: wrap bare code in main()
  if ((lang === 'rust' || lang === 'rs') && !/\bfn\s+main\s*\(/.test(src)) {
    const indented = src.split('\n').map((l) => '    ' + l).join('\n');
    return `fn main() {\n${indented}\n}`;
  }

  // Go: wrap in package main + func main if not present
  if ((lang === 'go' || lang === 'golang') && !/\bpackage\s+main\b/.test(src)) {
    const indented = src.split('\n').map((l) => '\t' + l).join('\n');
    return `package main\n\nimport "fmt"\n\nfunc main() {\n${indented}\n}`;
  }

  return src;
};

// ─── Universal Piston-based runner ───────────────────────────────────────────
async function runWithPiston(code, langKey) {
  const key = (langKey || '').toLowerCase();
  const mapping = PISTON_LANG_MAP[key];

  if (!mapping) {
    return {
      output: null,
      error: `"${langKey || 'unknown'}" is not currently supported for execution.\nSupported languages: Python, JavaScript, TypeScript, C, C++, Java, Go, Rust, Ruby, PHP, C#, Kotlin, Swift, Bash, Dart, Scala, Lua, Perl, R, Elixir, Haskell, Zig, Julia.`,
    };
  }

  const wrappedCode = wrapCodeForExecution(code, key);

  const res = await fetch('https://emkc.org/api/v2/piston/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: mapping.language,
      version: mapping.version,
      files: [{ name: mapping.filename, content: wrappedCode }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Piston API error ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  const stdout = (data.run?.stdout || '').trim();
  const stderr = (data.run?.stderr || '').trim();
  const exitCode = data.run?.code ?? 0;
  const compileErr = (data.compile?.stderr || '').trim();

  // Compilation error (C, C++, Java etc.)
  if (compileErr) {
    return { output: stdout || null, error: `Compilation Error:\n${compileErr}` };
  }

  // Runtime error
  if (exitCode !== 0 && stderr) {
    return { output: stdout || null, error: stderr };
  }

  const combined = [stdout, stderr].filter(Boolean).join('\n');
  return { output: combined || '(no output)', error: null };
}


// ─── Component ───────────────────────────────────────────────────────────────
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

  // Run ORIGINAL pasted code state
  const [runOrigOutput, setRunOrigOutput] = useState(null); // { output, error, lang }
  const [runOrigLoading, setRunOrigLoading] = useState(false);
  // Run FIXED refactored code state  
  const [runFixedOutput, setRunFixedOutput] = useState(null);
  const [runFixedLoading, setRunFixedLoading] = useState(false);

  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from('.navbar', { y: -50, opacity: 0, duration: 0.6, ease: 'power3.out' })
      .from('.workspace-header', { y: 20, opacity: 0, duration: 0.5, ease: 'power2.out' }, '-=0.3')
      .from('.panel', { y: 30, opacity: 0, duration: 0.5, stagger: 0.15, ease: 'power2.out' }, '-=0.3');
  }, { scope: containerRef });

  // Prefetch Piston runtimes on mount — warms the connection for faster first Run
  useEffect(() => {
    fetch('https://emkc.org/api/v2/piston/runtimes').catch(() => { /* silent fail */ });
  }, []);

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

  const detectedLang = detectLanguageFromBlocks(
    refactoredParsed.codeBlocks,
    refactoredParsed.codeBlocks.map((b) => b.code).join('\n')
  ) || (codeRef.current ? detectLanguageFromBlocks([], codeRef.current) : 'unknown');

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

  // Helper: run any code snippet using the Piston API
  const runCodeSnippet = async (snippet, langHint) => {
    const effectiveLang = (langHint || detectedLang || 'unknown').toLowerCase();
    const displayName = LANG_DISPLAY[effectiveLang] || effectiveLang;
    try {
      const result = await runWithPiston(snippet, effectiveLang);
      return { ...result, lang: displayName };
    } catch (e) {
      return { output: null, error: e.message || String(e), lang: displayName };
    }
  };

  // Run ORIGINAL pasted code — shows what error/output the buggy code produces
  const handleRunOriginal = useCallback(async () => {
    const originalCode = (codeRef.current || code || '').trim();
    if (!originalCode) {
      setRunOrigOutput({ output: null, error: 'No code pasted yet.', lang: 'unknown' });
      return;
    }
    setRunOrigLoading(true);
    setRunOrigOutput(null);
    const result = await runCodeSnippet(originalCode);
    setRunOrigOutput(result);
    setRunOrigLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, detectedLang]);

  // Run FIXED refactored code — shows that the fixed code works
  const handleRunFixed = useCallback(async () => {
    const joinedCode = refactoredParsed.codeBlocks
      .map((block) => block.code)
      .filter(Boolean)
      .join('\n\n');
    if (!joinedCode) {
      setRunFixedOutput({ output: null, error: 'No refactored code available.', lang: 'unknown' });
      return;
    }
    setRunFixedLoading(true);
    setRunFixedOutput(null);
    const result = await runCodeSnippet(joinedCode);
    setRunFixedOutput(result);
    setRunFixedLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refactoredParsed.codeBlocks, detectedLang]);

  const handleReview = async () => {
    const currentCode = (codeRef.current || code || '').trim();
    if (!currentCode) {
      setError('Please paste code before requesting a review.');
      return;
    }

    setLoading(true);
    setError('');
    setReviewRaw('');
    setRunOrigOutput(null);
    setRunFixedOutput(null);

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

  // Score color based on value
  const getScoreClass = (score) => {
    if (score === null) return '';
    if (score >= 80) return 'score-high';
    if (score >= 50) return 'score-mid';
    return 'score-low';
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
              <div className={`score-pill ${getScoreClass(parsed.score)}`}>
                {parsed.score !== null ? `Score: ${parsed.score}/100` : 'Score: -'}
              </div>
              {isLiveAi && <div className="live-pill">Live AI</div>}
              {parsed.isFallback && <div className="fallback-pill">Fallback Used</div>}
            </div>

            {/* Verdict explanation banner */}
            {parsed.verdict && (
              <div className={`verdict-explanation verdict-explanation--${parsed.verdict.toLowerCase()}`}>
                {parsed.verdict === 'FAIL' && (
                  <>
                    <span className="verdict-icon">❌</span>
                    <span>Your code has <strong>critical issues</strong> that will cause errors or failures at runtime. See details below.</span>
                  </>
                )}
                {parsed.verdict === 'WARN' && (
                  <>
                    <span className="verdict-icon">⚠️</span>
                    <span>Your code has <strong>potential issues</strong> that may cause bugs or poor performance. Review suggestions below.</span>
                  </>
                )}
                {parsed.verdict === 'PASS' && (
                  <>
                    <span className="verdict-icon">✅</span>
                    <span>Your code <strong>passes</strong> review. Minor improvements may still be suggested below.</span>
                  </>
                )}
              </div>
            )}

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
                  <i className="ri-file-copy-line"></i> Copy Fixed Code
                </button>
                <button
                  type="button"
                  className="run-original-button"
                  onClick={handleRunOriginal}
                  disabled={runOrigLoading}
                  title="Run your original pasted code to see the error it produces"
                >
                  <i className={runOrigLoading ? 'ri-loader-4-line spin' : 'ri-bug-line'}></i>
                  {runOrigLoading ? 'Running…' : 'Run Original'}
                </button>
                <button
                  type="button"
                  className="run-code-button"
                  onClick={handleRunFixed}
                  disabled={runFixedLoading}
                  title="Run the fixed/refactored code to confirm it works"
                >
                  <i className={runFixedLoading ? 'ri-loader-4-line spin' : 'ri-play-fill'}></i>
                  {runFixedLoading ? 'Running…' : 'Run Fixed'}
                </button>
                {copyStatus && <span className="copy-status">{copyStatus}</span>}
              </div>

              <p className="output-note">
                {parsed.verdict === 'PASS'
                  ? 'Your code looks good. Minor improvements may still be applied below.'
                  : parsed.verdict === 'WARN'
                    ? 'Your code has potential issues. The refactored version below applies improvements.'
                    : 'Your code has critical issues. The refactored version below fixes them — compare the outputs!'}
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

              {/* Original code output panel */}
              {runOrigOutput !== null && (
                <div className="run-output-panel">
                  <div className="run-output-header">
                    <span className="run-output-title">
                      <i className="ri-bug-line"></i> Original Code Output
                      {runOrigOutput?.lang && <span className="run-lang-badge">{runOrigOutput.lang}</span>}
                    </span>
                    <button
                      className="run-clear-btn"
                      type="button"
                      onClick={() => setRunOrigOutput(null)}
                      title="Clear output"
                    >
                      <i className="ri-close-line"></i>
                    </button>
                  </div>
                  <div className={`run-output-body ${runOrigOutput.error ? 'run-output-error' : 'run-output-success'}`}>
                    {runOrigOutput.error ? (
                      <>
                        <div className="run-output-label-err"><i className="ri-error-warning-line"></i> Error (as expected for buggy code)</div>
                        <pre className="run-output-text">{runOrigOutput.error}</pre>
                      </>
                    ) : (
                      <>
                        <div className="run-output-label-ok"><i className="ri-check-line"></i> Output</div>
                        <pre className="run-output-text">{runOrigOutput.output}</pre>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Fixed code output panel */}
              {runFixedOutput !== null && (
                <div className="run-output-panel">
                  <div className="run-output-header">
                    <span className="run-output-title">
                      <i className="ri-checkbox-circle-line"></i> Fixed Code Output
                      {runFixedOutput?.lang && <span className="run-lang-badge">{runFixedOutput.lang}</span>}
                    </span>
                    <button
                      className="run-clear-btn"
                      type="button"
                      onClick={() => setRunFixedOutput(null)}
                      title="Clear output"
                    >
                      <i className="ri-close-line"></i>
                    </button>
                  </div>
                  <div className={`run-output-body ${runFixedOutput.error ? 'run-output-error' : 'run-output-success'}`}>
                    {runFixedOutput.error ? (
                      <>
                        <div className="run-output-label-err"><i className="ri-error-warning-line"></i> Error</div>
                        <pre className="run-output-text">{runFixedOutput.error}</pre>
                      </>
                    ) : (
                      <>
                        <div className="run-output-label-ok"><i className="ri-check-line"></i> Output</div>
                        <pre className="run-output-text">{runFixedOutput.output}</pre>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
    </div>
  );
}

export default App;