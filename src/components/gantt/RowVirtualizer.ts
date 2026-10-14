"use client";
import { useEffect, useRef, useState } from "react";
import {
  HEADER_HEIGHT,
  LIST_WIDTH,
  ZOOMS,
  type Zoom,
} from "@/lib/scheduling/constants";
import { visibleRange } from "@/lib/scheduling/geometry";
export function useRowVirtualizer(count: number, days: number, zoom: Zoom) {
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({
    top: 0,
    left: 0,
    width: 1200,
    height: 600,
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      setView((v) => ({
        ...v,
        width: el.clientWidth,
        height: el.clientHeight,
      }));
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const onScroll = () => {
    const el = ref.current;
    if (el) setView((v) => ({ ...v, top: el.scrollTop, left: el.scrollLeft }));
  };
  const range = visibleRange(
    Math.max(0, view.top - HEADER_HEIGHT),
    view.height,
    count,
  );
  const listWidth = Math.min(
    LIST_WIDTH,
    Math.max(230, Math.round(view.width * 0.44)),
  );
  const first = Math.max(0, Math.floor(view.left / ZOOMS[zoom]) - 2);
  const last = Math.min(
    days,
    Math.ceil((view.left + view.width - listWidth) / ZOOMS[zoom]) + 2,
  );
  return { ref, onScroll, range, listWidth, first, last };
}
