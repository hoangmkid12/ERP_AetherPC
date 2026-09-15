import { useEffect, useState } from 'react';

// CSS viewport units (100vh/100dvh/100svh) proved unreliable in practice on
// real iOS Safari for the Delivery mobile shell: 100vh assumes the toolbar
// is collapsed (content ends up hidden below the fold while the toolbar is
// showing), and 100dvh/100svh either got tucked behind the still-expanded
// toolbar or left a blank gap once the toolbar state changed mid-session —
// this varies by iOS/Safari version and is hard to fully control from CSS
// alone. window.visualViewport.height is the browser API purpose-built for
// this: it always reflects the actual currently-visible area (toolbar and
// on-screen keyboard included), live-updated, so we drive the shell/modal
// height from it directly instead of trusting a CSS unit to get it right.
export default function useSafeViewportHeight() {
  const getHeight = () => {
    if (typeof window === 'undefined') return 800;
    return Math.round((window.visualViewport && window.visualViewport.height) || window.innerHeight);
  };

  const [height, setHeight] = useState(getHeight);

  useEffect(() => {
    const update = () => setHeight(getHeight());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, []);

  return height;
}
