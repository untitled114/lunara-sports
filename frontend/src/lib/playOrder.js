// A play's place in the game's time order. ESPN renumbers plays mid-game, so the stored
// sequence number is not a time order; plays written since the API stores ESPN's list
// position carry it as `espn_order`. Older rows fall back to the sequence number.
export function playTime(play) {
  return play.espn_order ?? play.sequence_number;
}

export const oldestFirst = (a, b) => playTime(a) - playTime(b);
export const newestFirst = (a, b) => playTime(b) - playTime(a);

// One entry per play row (its id): a renumbered play replaces its old copy, and a play
// that took over another's number never hides it. Newest first.
export function mergePlays(prev, incoming) {
  const byId = new Map(prev.map((p) => [p.id, p]));
  for (const p of incoming) byId.set(p.id, p);
  return [...byId.values()].sort(newestFirst);
}
