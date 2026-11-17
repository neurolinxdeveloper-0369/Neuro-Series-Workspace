import { App as NativeApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useEffect, useLayoutEffect, useRef } from 'react';

export function useScreenGestures(
  canGoBack: boolean,
  goBack: () => boolean,
  refresh: () => void,
) {
  const actions = useRef({ goBack, refresh });
  const touchStart = useRef<{ x: number; y: number; atTop: boolean } | undefined>(undefined);
  useLayoutEffect(() => { actions.current = { goBack, refresh }; }, [goBack, refresh]);
  const android = Capacitor.getPlatform() === 'android';

  useEffect(() => {
    if (android || !canGoBack || history.state?.neuroBack) return;
    history.pushState({ ...history.state, neuroBack: true }, '');
  }, [android, canGoBack]);

  useEffect(() => {
    if (android) {
      const listener = NativeApp.addListener('backButton', () => actions.current.goBack());
      return () => { void listener.then(handle => handle.remove()).catch(() => {}); };
    }

    const handleBack = () => {
      if (actions.current.goBack() && !history.state?.neuroBack) {
        history.pushState({ ...history.state, neuroBack: true }, '');
      }
    };
    window.addEventListener('popstate', handleBack);
    return () => window.removeEventListener('popstate', handleBack);
  }, [android]);

  useEffect(() => {
    const onStart = (event: TouchEvent) => {
      touchStart.current = undefined;
      const target = event.target;
      if (event.touches.length !== 1 || !(target instanceof Element) ||
          target.closest('input, textarea, select, [contenteditable], [data-no-screen-gesture]')) return;
      const touch = event.touches[0];
      let atTop = true;
      for (let element: Element | null = target; element; element = element.parentElement) {
        if (element.scrollTop > 1 && /auto|scroll/.test(getComputedStyle(element).overflowY)) {
          atTop = false;
          break;
        }
      }
      touchStart.current = { x: touch.clientX, y: touch.clientY, atTop };
    };
    const cancel = () => { touchStart.current = undefined; };
    const onMove = (event: TouchEvent) => { if (event.touches.length !== 1) cancel(); };
    const onEnd = (event: TouchEvent) => {
      const origin = touchStart.current;
      cancel();
      if (!origin || event.touches.length || event.changedTouches.length !== 1) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - origin.x;
      const dy = touch.clientY - origin.y;
      if (Capacitor.getPlatform() === 'ios' && origin.x <= 24 && dx >= 80 && dx > Math.abs(dy) * 1.5) {
        actions.current.goBack();
      } else if (origin.atTop && dy >= 75 && dy > Math.abs(dx) * 1.5) {
        actions.current.refresh();
      }
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchcancel', cancel);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', cancel);
    };
  }, []);
}
