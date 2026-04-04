import { useState, useEffect, useRef } from 'react';
import { Settings, Sprout, Footprints, Gamepad2, MessageSquare, BarChart2, Check } from 'lucide-react';
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Aplica a fonte globalmente via CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty('--app-font', chatFont);
  }, [chatFont]);

  // Fecha settings ao clicar fora
  useEffect(() => {
    if (!settingsOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [settingsOpen]);

  const NAV_PAGES: Array<{ key: Page; icon: React.ReactNode; label: string }> = [
    { key: 'garden', icon: <Sprout size={13} />,      label: tl('navGarden') },
    { key: 'buddy',  icon: <Footprints size={13} />,    label: tl('navBuddy') },
    { key: 'play',   icon: <Gamepad2 size={13} />,     label: tl('navPlay') },
    { key: 'chat',   icon: <MessageSquare size={13} />, label: tl('navChat') },
    { key: 'stats',  icon: <BarChart2 size={13} />,    label: tl('navStats') },
  ];

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav style={navStyle}>
        {/* Botões de página */}
        {NAV_PAGES.map(({ key, icon, label }) => (
          <button
            key={key}
            style={btnStyle(page === key)}
            onClick={() => setPage(key)}
            title={label}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {icon}
              <span style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 9 }}>{label}</span>
            </span>
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Settings button */}
        <div ref={settingsRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <button
            style={{
              ...navIconBtn,
              color: settingsOpen ? '#aabbff' : '#888',
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 10px',
              background: settingsOpen ? 'rgba(80,80,200,0.15)' : 'transparent',
              border: settingsOpen ? '1px solid rgba(80,80,200,0.4)' : '1px solid #2a2a40',
              transition: 'all 0.15s',
            }}
            title="Settings"
            onClick={() => setSettingsOpen(o => !o)}
          >
            <Settings size={15} strokeWidth={1.5} />
          </button>

          {settingsOpen && (
            <div style={settingsDropdown}>
              {/* Lang toggle */}
              <div style={settingsSection}>
                <div style={settingsSectionLabel}>{tl('chatLangToggle')}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['pt', 'en'] as const).map(l => (
                    <button
                      key={l}
                      onClick={() => { setLang(l); }}
                      style={{
                        flex: 1,
                        padding: '7px 0',
                        background: lang === l ? 'rgba(80,80,200,0.25)' : 'transparent',
                        border: `1px solid ${lang === l ? '#6a6aee' : '#2a2a40'}`,
                        color: lang === l ? '#aabbff' : '#666',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: 12,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        transition: 'all 0.15s',
                      }}
                    >
                      {lang === l && <Check size={9} />}
                      {l === 'pt' ? '🇧🇷 PT' : '🇺🇸 EN'}
                    </button>
                  ))}
                </div>
              </div>

              <div style={settingsDivider} />

              {/* Font picker */}
              <div style={settingsSection}>
                <div style={settingsSectionLabel}>{tl('navFontPicker')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {CHAT_FONTS.map(f => (
                    <button
                      key={f.value}
                      onClick={() => setChatFont(f.value)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', textAlign: 'left',
                        padding: '8px 10px',
                        background: chatFont === f.value ? 'rgba(80,80,200,0.2)' : 'transparent',
                        border: 'none',
                        borderLeft: chatFont === f.value ? '2px solid #6a6aee' : '2px solid transparent',
                        color: chatFont === f.value ? '#aabbff' : '#888',
                        cursor: 'pointer',
                        fontFamily: f.value,
                        fontSize: f.previewSize ?? 13,
                        lineHeight: 1.4,
                        transition: 'all 0.1s',
                      }}
                    >
                      {f.label}
                      {chatFont === f.value && <Check size={11} color="#6a6aee" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
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
  gap: '3px',
  background: '#0d0d1a',
  borderBottom: '2px solid #1e1e3a',
  padding: '5px 8px',
  flexShrink: 0,
};

function btnStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    padding: '7px 12px',
    background: active ? '#2a2a5a' : 'transparent',
    color: active ? '#aabbff' : '#666',
    border: 'none',
    borderBottom: active ? '2px solid #6a6aee' : '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.15s',
    gap: 5,
    flexShrink: 0,
  };
}

const navIconBtn: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #2a2a40',
  color: '#888',
  cursor: 'pointer',
  padding: '6px 10px',
  fontSize: '14px',
};

const settingsDropdown: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  right: 0,
  zIndex: 50,
  background: 'rgba(8,8,24,0.98)',
  border: '1px solid rgba(80,80,180,0.35)',
  minWidth: 210,
  boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
  animation: 'fadeDown 0.15s ease-out',
};

const settingsSection: React.CSSProperties = {
  padding: '12px 14px',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const settingsSectionLabel: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 10,
  color: '#444',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 2,
};

const settingsDivider: React.CSSProperties = {
  height: 1,
  background: 'rgba(80,80,180,0.15)',
  margin: '0 14px',
};
