const PLAYER_KEY = 'starhopper.player-id';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OUTCOMES = new Set(['correct', 'near-miss', 'incorrect']);

// A random browser identity, independent of saved progress and GoatCounter sessions.
// Only catalogue IDs and outcomes are sent; never the text in the answer field.
export function createGuessTracker({storage, getCounter, makeId = () => globalThis.crypto.randomUUID()}) {
  let playerId;
  const pending = [];

  function identity() {
    if (playerId) return playerId;
    try {
      const saved = storage?.getItem(PLAYER_KEY);
      if (UUID.test(saved)) playerId = saved;
    } catch { /* Storage can be disabled; use an in-memory identity instead. */ }
    if (!playerId) {
      playerId = makeId();
      if (!UUID.test(playerId)) { playerId = undefined; return; }
      try { storage?.setItem(PLAYER_KEY, playerId); } catch { /* Session-only. */ }
    }
    return playerId;
  }

  function flush() {
    try {
      const counter = getCounter();
      if (typeof counter?.count !== 'function') return;
      while (pending.length) {
        // Remove before sending: a failed call must not duplicate later guesses.
        const event = pending.shift();
        try { counter.count(event); } catch { /* Analytics must never interrupt play. */ }
      }
    } catch { /* A blocked tracker must never interrupt play. */ }
  }

  function recordGuess(star, outcome) {
    try {
      if (!OUTCOMES.has(outcome) || !star?.id || !star?.name) return;
      const id = identity();
      if (!id) return;
      // A bounded, memory-only queue handles guesses made before the async script loads.
      if (pending.length === 100) pending.shift();
      pending.push({
        path: `starhopper/guess/${encodeURIComponent(star.id)}/${outcome}/player/${id}`,
        title: `Starhopper · ${star.name} · ${outcome} · player ${id}`,
        event: true,
        no_session: true,
        referrer: '',
      });
      flush();
    } catch { /* Even unavailable secure randomness must not break the game. */ }
  }

  return {recordGuess, flush};
}
