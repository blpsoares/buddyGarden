import { useState, useEffect } from 'react';

interface Breakpoint {
  isMobile: boolean;   // < 640px
  isTablet: boolean;   // < 1024px
  width: number;
}

function getBreakpoint(): Breakpoint {
  const w = window.innerWidth;
  return { isMobile: w < 640, isTablet: w < 1024, width: w };
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(getBreakpoint);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const handler = () => setBp(getBreakpoint());
    // Use addEventListener if available, fallback for older Safari
    if (mq.addEventListener) {
      mq.addEventListener('change', handler);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      mq.addListener(handler);
    }
    // Also listen to resize for width value
    window.addEventListener('resize', handler);
    return () => {
      if (mq.removeEventListener) {
        mq.removeEventListener('change', handler);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        mq.removeListener(handler);
      }
      window.removeEventListener('resize', handler);
    };
  }, []);

  return bp;
}
