/**
 * Saved-System helpers — pure functions only.
 *
 * No I/O, no React, no global state. Persistence lives in
 * `./repository`. Future advisory builders can import these helpers to
 * shape SavedSystemProfile objects deterministically.
 */

import type {
  SavedSystemProfile,
  SavedSystemRole,
  SavedSystemSlot,
  SavedSystemComponentRow,
  SavedSystemComponentStatus,
  SavedSystemRoom,
} from './types';

// ── Id generation ─────────────────────────────────────

/** Tiny uuid-ish id generator. Avoids pulling a dependency for the
 *  Phase-1 foundation. Sufficient for local persistence; the backend
 *  will assign authoritative ids when this is later promoted. */
export function newSystemId(prefix: string = 'sys'): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}_${time}_${rand}`;
}

// ── Constructors ──────────────────────────────────────

export interface CreateSystemInput {
  label: string;
  role: SavedSystemRole;
  userId?: string;
  components?: Array<Omit<SavedSystemComponentRow, 'id'> & { id?: string }>;
  room?: SavedSystemRoom;
}

/** Build a fresh SavedSystemProfile. Pure — does not persist. */
export function createSystem(input: CreateSystemInput): SavedSystemProfile {
  const now = Date.now();
  return {
    id: newSystemId(),
    userId: input.userId ?? '',
    label: input.label.trim() || 'Untitled system',
    role: input.role,
    createdAt: now,
    updatedAt: now,
    components: (input.components ?? []).map((c) => ({
      ...c,
      id: c.id ?? newSystemId('cmp'),
    })),
    room: input.room,
  };
}

// ── Mutators (return new objects, never mutate in place) ──

/** Bump the updatedAt timestamp on a system. */
export function touch(system: SavedSystemProfile, when: number = Date.now()): SavedSystemProfile {
  return { ...system, updatedAt: when };
}

export interface AddComponentInput {
  slot: SavedSystemSlot;
  productId?: string;
  freeText?: string;
  status?: SavedSystemComponentStatus;
  notes?: string;
}

export function addComponent(
  system: SavedSystemProfile,
  input: AddComponentInput,
): SavedSystemProfile {
  if (!input.productId && !input.freeText) {
    throw new Error('addComponent: either productId or freeText is required');
  }
  const row: SavedSystemComponentRow = {
    id: newSystemId('cmp'),
    slot: input.slot,
    productId: input.productId,
    freeText: input.freeText,
    status: input.status ?? 'current',
    notes: input.notes,
  };
  return touch({ ...system, components: [...system.components, row] });
}

export function removeComponent(
  system: SavedSystemProfile,
  componentRowId: string,
): SavedSystemProfile {
  return touch({
    ...system,
    components: system.components.filter((c) => c.id !== componentRowId),
  });
}

export function updateComponent(
  system: SavedSystemProfile,
  componentRowId: string,
  patch: Partial<Omit<SavedSystemComponentRow, 'id'>>,
): SavedSystemProfile {
  return touch({
    ...system,
    components: system.components.map((c) =>
      c.id === componentRowId ? { ...c, ...patch } : c,
    ),
  });
}

export function setRoom(
  system: SavedSystemProfile,
  room: SavedSystemRoom | undefined,
): SavedSystemProfile {
  return touch({ ...system, room });
}

export function renameSystem(
  system: SavedSystemProfile,
  label: string,
): SavedSystemProfile {
  const cleaned = label.trim();
  if (!cleaned) return system;
  return touch({ ...system, label: cleaned });
}

// ── Read helpers ──────────────────────────────────────

/** Return the first component occupying a given slot, or undefined. */
export function componentInSlot(
  system: SavedSystemProfile,
  slot: SavedSystemSlot,
): SavedSystemComponentRow | undefined {
  return system.components.find((c) => c.slot === slot && c.status === 'current');
}

/** Return all components in a given slot (some slots can carry more
 *  than one row, e.g. multiple sources). */
export function componentsInSlot(
  system: SavedSystemProfile,
  slot: SavedSystemSlot,
): SavedSystemComponentRow[] {
  return system.components.filter((c) => c.slot === slot);
}
