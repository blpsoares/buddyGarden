interface Props {
  text: string;
  style?: React.CSSProperties;
}

export function SpeechBubble({ text, style }: Props) {
  return (
    <div style={{ position: 'relative', display: 'inline-block', ...style }}>
      <div
        style={{
          background: '#fff',
          color: '#111',
          border: '3px solid #000',
          boxShadow: '3px 3px 0 #000',
          padding: '8px 12px',
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '8px',
          lineHeight: '1.6',
          maxWidth: '200px',
          wordBreak: 'break-word',
        }}
      >
        {text}
      </div>
      {/* Tail */}
      <div
        style={{
          position: 'absolute',
          bottom: '-12px',
          left: '16px',
          width: 0,
          height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: '10px solid #000',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-8px',
          left: '18px',
          width: 0,
          height: 0,
          borderLeft: '4px solid transparent',
          borderRight: '4px solid transparent',
          borderTop: '7px solid #fff',
        }}
      />
    </div>
  );
}
