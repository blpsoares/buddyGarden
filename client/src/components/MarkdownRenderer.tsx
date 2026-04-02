import type { ReactNode, CSSProperties } from 'react';

// ── Simple markdown → React JSX renderer (sem dependências externas) ──────────
// Suporta: code blocks, inline code, **bold**, *italic*, # headers, - listas, \n

interface Props {
  content: string;
  streaming?: boolean;
  style?: CSSProperties;
}

export function MarkdownRenderer({ content, streaming, style }: Props) {
  return (
    <div style={{ ...baseStyle, ...style }}>
      {parseBlocks(content)}
      {streaming && (
        <span style={{ display: 'inline-block', animation: 'blink 1s infinite', marginLeft: 2, opacity: 0.8 }}>▌</span>
      )}
    </div>
  );
}

// ── Block-level parsing ────────────────────────────────────────────────────────

function parseBlocks(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Separa code blocks (```...```) do resto
  const parts = text.split(/(```[\s\S]*?```)/g);

  parts.forEach((part, i) => {
    if (part.startsWith('```')) {
      const match = part.match(/^```(\w*)\n?([\s\S]*?)```$/);
      const lang = match?.[1] ?? '';
      const code = match?.[2] ?? part.slice(3, -3);
      nodes.push(<CodeBlock key={i} lang={lang} code={code.trimEnd()} />);
    } else {
      // Processa linhas normais
      const lines = part.split('\n');
      let ulBuffer: string[] = [];

      const flushList = () => {
        if (ulBuffer.length === 0) return;
        nodes.push(
          <ul key={`ul-${i}-${nodes.length}`} style={ulStyle}>
            {ulBuffer.map((item, j) => (
              <li key={j} style={{ marginBottom: 2 }}>{parseInline(item)}</li>
            ))}
          </ul>
        );
        ulBuffer = [];
      };

      lines.forEach((line, li) => {
        // Headers
        const h3 = line.match(/^###\s+(.*)/);
        const h2 = line.match(/^##\s+(.*)/);
        const h1 = line.match(/^#\s+(.*)/);
        // Bullet list
        const bullet = line.match(/^[-*]\s+(.*)/);
        // Numbered list
        const numbered = line.match(/^\d+\.\s+(.*)/);

        if (h1 || h2 || h3) {
          flushList();
          const level = h3 ? 3 : h2 ? 2 : 1;
          const text = (h3 ?? h2 ?? h1)![1]!;
          const hs: CSSProperties = {
            fontFamily: 'sans-serif',
            fontWeight: 700,
            fontSize: level === 1 ? 16 : level === 2 ? 14 : 13,
            color: '#ddd',
            margin: '8px 0 4px',
            lineHeight: 1.3,
          };
          nodes.push(<div key={`h${level}-${i}-${li}`} style={hs}>{parseInline(text)}</div>);
        } else if (bullet || numbered) {
          const itemText = (bullet ?? numbered)![1]!;
          ulBuffer.push(itemText);
        } else if (line.trim() === '') {
          flushList();
          if (nodes.length > 0 && li > 0) {
            nodes.push(<br key={`br-${i}-${li}`} />);
          }
        } else {
          flushList();
          nodes.push(
            <span key={`p-${i}-${li}`} style={{ display: 'block', marginBottom: 1 }}>
              {parseInline(line)}
            </span>
          );
        }
      });

      flushList();
    }
  });

  return nodes;
}

// ── Inline parsing ─────────────────────────────────────────────────────────────

function parseInline(text: string): ReactNode[] {
  // Ordem: inline code → bold → italic
  const tokens = tokenize(text);
  return tokens.map((t, i) => {
    if (t.type === 'code')   return <code key={i} style={inlineCodeStyle}>{t.text}</code>;
    if (t.type === 'bold')   return <strong key={i} style={{ color: '#fff' }}>{t.text}</strong>;
    if (t.type === 'italic') return <em key={i} style={{ color: '#ccc' }}>{t.text}</em>;
    return <span key={i}>{t.text}</span>;
  });
}

type Token = { type: 'text' | 'code' | 'bold' | 'italic'; text: string };

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  // Regex que captura: `code`, **bold**, *italic*
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', text: text.slice(last, m.index) });

    const raw = m[0];
    if (raw.startsWith('`'))  tokens.push({ type: 'code',   text: raw.slice(1, -1) });
    else if (raw.startsWith('**')) tokens.push({ type: 'bold',   text: raw.slice(2, -2) });
    else                      tokens.push({ type: 'italic', text: raw.slice(1, -1) });

    last = m.index + raw.length;
  }

  if (last < text.length) tokens.push({ type: 'text', text: text.slice(last) });
  return tokens;
}

// ── CodeBlock ─────────────────────────────────────────────────────────────────

export const SHELL_LANGS = new Set(['bash', 'sh', 'shell', 'zsh', 'fish']);

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const isShell = SHELL_LANGS.has(lang.toLowerCase());
  return (
    <div style={codeBlockWrap}>
      {lang && (
        <div style={codeLangBar}>
          <span>{lang}</span>
        </div>
      )}
      <pre style={{ ...codeBlockPre, borderTop: lang ? '1px solid #2a2a4a' : undefined }}>
        {isShell && <span style={{ color: '#4caf50', userSelect: 'none' }}>$ </span>}
        <code style={{ color: isShell ? '#a8f0a8' : '#c8e0ff', fontFamily: 'monospace', fontSize: 13 }}>
          {code}
        </code>
      </pre>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const baseStyle: CSSProperties = {
  fontFamily: 'sans-serif',
  fontSize: 14,
  lineHeight: 1.6,
  color: '#eee',
  wordBreak: 'break-word',
};

const inlineCodeStyle: CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 13,
  background: '#1a1a3a',
  border: '1px solid #333',
  borderRadius: 3,
  padding: '0 4px',
  color: '#a8c8ff',
};

const codeBlockWrap: CSSProperties = {
  margin: '8px 0',
  border: '1px solid #2a2a5a',
  background: '#0d0d20',
  overflow: 'hidden',
};

const codeLangBar: CSSProperties = {
  background: '#1a1a3a',
  padding: '3px 10px',
  fontSize: 11,
  fontFamily: 'monospace',
  color: '#6688cc',
  borderBottom: '1px solid #2a2a4a',
};

const codeBlockPre: CSSProperties = {
  margin: 0,
  padding: '10px 14px',
  overflowX: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
};

const ulStyle: CSSProperties = {
  margin: '4px 0',
  paddingLeft: 20,
  color: '#ddd',
  fontSize: 14,
  fontFamily: 'sans-serif',
};
