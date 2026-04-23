/**
 * /systems/saved — isolated host for the new SavedSystemsPanel.
 *
 * Deliberately a thin wrapper. Does not touch the legacy /systems
 * Prisma-backed flow, advisory pipeline, or navigation.
 */

'use client';

import { SavedSystemsPanel } from '@/components/saved-system/SavedSystemsPanel';

export default function SavedSystemsPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 720 }}>
      <SavedSystemsPanel />
    </div>
  );
}
