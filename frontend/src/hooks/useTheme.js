import { useEffect } from 'react';
import { useChatStore } from '../store/chatStore';

export function useTheme() {
  const theme = useChatStore((state) => state.theme);
  const setTheme = useChatStore((state) => state.setTheme);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return { theme, toggleTheme };
}
