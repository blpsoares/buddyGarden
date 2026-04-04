import { useState, useEffect } from 'react';
import { Garden } from './pages/Garden.tsx';
import { Chat } from './pages/Chat.tsx';
import { Stats } from './pages/Stats.tsx';
import { BuddyMode } from './pages/BuddyMode.tsx';
import { PlayMode } from './pages/PlayMode.tsx';
import { ChatProvider, useSharedChat } from './context/ChatContext.tsx';
import { CHAT_FONTS } from './pages/Chat.tsx';
import { t } from './i18n.ts';

export type Page = 'garden' | 'chat' | 'stats' | 'buddy' | 'play';

export default function App() {
  const [page, setPage] = useState<Page>('garden');

  return (
    <ChatProvider>
      <AppShell page={page} setPage={setPage} />
    </ChatProvider>
  );
}

function AppShell({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
  const { lang, setLang, chatFont, setChatFont } = useSharedChat();
  const tl = (key: Parameters<typeof t>[1]) => t(lang, key);
  const [fontPickerOpen, setFontPickerOpen] = useState(false);

  // Aplica a fonte globalmente via CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty('--app-font', chatFont);
  }, [chatFont]);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav style={navStyle}>
        {/* Botões de página */}
        <button style={btnStyle(page === 'garden')} onClick={() => setPage('garden')}>
          {tl('navGarden')}
        </button>
        <button style={btnStyle(page === 'buddy')} onClick={() => setPage('buddy')}>
          {tl('navBuddy')}
        </button>
        <button style={btnStyle(page === 'play')} onClick={() => setPage('play')}>
          {tl('navPlay')}
        </button>
        <button style={btnStyle(page === 'chat')} onClick={() => setPage('chat')}>
          {tl('navChat')}
        </button>
        <button style={btnStyle(page === 'stats')} onClick={() => setPage('stats')}>
          {tl('navStats')}
        </button>

        {/* Espaço */}
        <div style={{ flex: 1 }} />

        {/* Font picker */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <button
            style={{ ...navIconBtn, color: fontPickerOpen ? '#aabbff' : '#888' }}
            title={tl('navFontPicker')}
            onClick={() => setFontPickerOpen(o => !o)}
          >
            Aa
          </button>
          {fontPickerOpen && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 49 }}
                onClick={() => setFontPickerOpen(false)}
              />
              <div style={fontDropdown}>
                {CHAT_FONTS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => { setChatFont(f.value); setFontPickerOpen(false); }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '9px 14px',
                      background: chatFont === f.value ? 'rgba(80,80,200,0.25)' : 'transparent',
                      border: 'none',
                      borderLeft: chatFont === f.value ? '3px solid #6a6aee' : '3px solid transparent',
                      color: chatFont === f.value ? '#aabbff' : '#ccc',
                      cursor: 'pointer',
                      fontFamily: f.value,
                      fontSize: f.previewSize ?? 14,
                      lineHeight: 1.5,
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Lang toggle */}
        <button
          style={{ ...navIconBtn, fontSize: 18 }}
          title={tl('chatLangToggle')}
          onClick={() => setLang(lang === 'pt' ? 'en' : 'pt')}
        >
          {lang === 'pt' ? '🇧🇷' : '🇺🇸'}
        </button>
      </nav>

      <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {page === 'garden' && <Garden onNavigate={setPage} />}
        {page === 'buddy' && <BuddyMode onNavigate={setPage} />}
        {page === 'play' && <PlayMode onNavigate={setPage} />}
        {page === 'chat' && <Chat />}
        {page === 'stats' && <Stats />}
      </main>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const navStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  background: '#0d0d1a',
  borderBottom: '2px solid #333',
  padding: '6px 8px',
  flexShrink: 0,
};

function btnStyle(active: boolean): React.CSSProperties {
  return {
    fontFamily: '"Press Start 2P", monospace',
    fontSize: '10px',
    padding: '8px 14px',
    background: active ? '#4a4a8a' : '#1a1a3a',
    color: active ? '#fff' : '#aaa',
    border: '2px solid',
    borderColor: active ? '#8888cc' : '#333',
    cursor: 'pointer',
    boxShadow: active ? '2px 2px 0 #000' : 'none',
    whiteSpace: 'nowrap',
  };
}

const navIconBtn: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #2a2a40',
  color: '#888',
  cursor: 'pointer',
  padding: '6px 10px',
  fontSize: '14px',
  fontFamily: '"Press Start 2P", monospace',
};

const fontDropdown: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  right: 0,
  zIndex: 50,
  background: 'rgba(8,8,24,0.98)',
  border: '1px solid rgba(80,80,180,0.4)',
  minWidth: 190,
  boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};
