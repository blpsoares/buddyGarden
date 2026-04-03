import { useState } from 'react';
import { Garden } from './pages/Garden.tsx';
import { Chat } from './pages/Chat.tsx';
import { Stats } from './pages/Stats.tsx';
import { BuddyMode } from './pages/BuddyMode.tsx';
import { PlayMode } from './pages/PlayMode.tsx';
import { ChatProvider } from './context/ChatContext.tsx';

export type Page = 'garden' | 'chat' | 'stats' | 'buddy' | 'play';

export default function App() {
  const [page, setPage] = useState<Page>('garden');

  return (
    <ChatProvider>
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav style={navStyle}>
        <button style={btnStyle(page === 'garden')} onClick={() => setPage('garden')}>
          🌱 Jardim
        </button>
        <button style={btnStyle(page === 'buddy')} onClick={() => setPage('buddy')}>
          🐾 Buddy
        </button>
        <button style={btnStyle(page === 'play')} onClick={() => setPage('play')}>
          🎮 Play
        </button>
        <button style={btnStyle(page === 'chat')} onClick={() => setPage('chat')}>
          💬 Chat
        </button>
        <button style={btnStyle(page === 'stats')} onClick={() => setPage('stats')}>
          📊 Stats
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
    </ChatProvider>
  );
}

const navStyle: React.CSSProperties = {
  display: 'flex',
  gap: '4px',
  background: '#0d0d1a',
  borderBottom: '2px solid #333',
  padding: '6px 8px',
};

function btnStyle(active: boolean): React.CSSProperties {
  return {
    fontFamily: '"Press Start 2P", monospace',
    fontSize: '11px',
    padding: '9px 16px',
    background: active ? '#4a4a8a' : '#1a1a3a',
    color: active ? '#fff' : '#aaa',
    border: '2px solid',
    borderColor: active ? '#8888cc' : '#333',
    cursor: 'pointer',
    boxShadow: active ? '2px 2px 0 #000' : 'none',
    imageRendering: 'pixelated',
  };
}
