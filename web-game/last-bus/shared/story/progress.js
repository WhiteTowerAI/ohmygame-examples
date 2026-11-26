/**
 * Remembers which optional clues a run has already looked at, so a hotspot
 * centre can mark them as found after the player returns from a side Scene.
 */
export function markSeen(context, id) {
  const seen = context.state.get("investigated") || [];
  if (!seen.includes(id)) context.state.set("investigated", [...seen, id]);
}

export function hasSeen(context, id) {
  return (context.state.get("investigated") || []).includes(id);
}
