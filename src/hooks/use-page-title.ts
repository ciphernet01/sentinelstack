import { useEffect } from 'react';

const APP_TITLE = 'SentinelStack';

export function usePageTitle(title?: string) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!title) {
      document.title = APP_TITLE;
      return;
    }
    document.title = `${title} | ${APP_TITLE}`;
  }, [title]);
}
