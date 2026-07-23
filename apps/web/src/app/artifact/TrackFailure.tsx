'use client';

/** Emits the assessment_failed funnel event on the guided failure path (M5). */
import { useEffect } from 'react';
import { track } from '@/product/analytics';

export default function TrackFailure() {
  useEffect(() => { track('assessment_failed'); }, []);
  return null;
}
