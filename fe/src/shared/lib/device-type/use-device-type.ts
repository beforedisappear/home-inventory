import { useSyncExternalStore } from 'react';

const BREAKPOINTS = {
  mobile: '(max-width: 767px)',
  desktop: '(min-width: 1024px)',
};

function getDeviceType() {
  if (window.matchMedia(BREAKPOINTS.mobile).matches) return 'mobile';

  return 'desktop';
}

function subscribe(callback: () => void) {
  const mqls = Object.values(BREAKPOINTS).map(query =>
    window.matchMedia(query),
  );

  mqls.forEach(mql => mql.addEventListener('change', callback));
  return () => {
    mqls.forEach(mql => mql.removeEventListener('change', callback));
  };
}

function getServerSnapshot() {
  return 'desktop';
}

export function useDeviceType() {
  const deviceType = useSyncExternalStore(
    subscribe,
    getDeviceType,
    getServerSnapshot,
  );

  return {
    deviceType,
    isMobile: deviceType === 'mobile',
    isDesktop: deviceType === 'desktop',
  };
}
