"use client";

import { useEffect, useState } from "react";

/** True only after the component has mounted (safe for portals / browser-only UI). */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
