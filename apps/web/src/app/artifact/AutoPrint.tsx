'use client';

/**
 * Arm the print dialog on a private artifact opened with `?print=1`.
 *
 * Print operates on the private snapshot and nothing else. This component
 * reads no snapshot, calls no API and mints nothing — Print must never alter
 * access state, and the simplest way to guarantee that is for the print path
 * to have no capability beyond `window.print`.
 */
import { useEffect } from 'react';

export default function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 350);
    return () => clearTimeout(t);
  }, []);
  return null;
}
