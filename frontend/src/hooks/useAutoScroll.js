import { useEffect, useRef, useState, useCallback } from 'react';

export function useAutoScroll(scrollTrigger = '') {
  const containerRef = useRef(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const isUserScrollingRef = useRef(false);

  const scrollToBottom = useCallback((smooth = true) => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
      setShowScrollBottom(false);
      isUserScrollingRef.current = false;
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    if (distanceFromBottom > 120) {
      setShowScrollBottom(true);
      isUserScrollingRef.current = true;
    } else {
      setShowScrollBottom(false);
      isUserScrollingRef.current = false;
    }
  }, []);

  useEffect(() => {
    // If user is not intentionally scrolled up, keep auto-scrolling
    if (!isUserScrollingRef.current && containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'auto',
      });
    }
  }, [scrollTrigger]);

  return { containerRef, showScrollBottom, scrollToBottom, handleScroll };
}
