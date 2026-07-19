import type { GameSummary } from '@emberfall/engine';

/**
 * Overlay listing every active game this browser belongs to, with the option
 * to resume one, abandon one, or start/join a new game.
 */
export function GameSwitcher({
  games,
  currentRoom,
  onResume,
  onAbandon,
  onNew,
  onClose,
}: {
  games: GameSummary[];
  currentRoom: string | null;
  onResume: (code: string) => void;
  onAbandon: (code: string) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const phaseLabel = (g: GameSummary) =>
    g.phase === 'lobby'
      ? 'waiting to start'
      : g.phase === 'won'
        ? 'victory'
        : g.phase === 'lost'
          ? 'defeat'
          : g.yourTurn
            ? 'your turn'
            : `${g.activeName ?? 'someone'}’s turn`;

  return (
    <div className="switcher-backdrop" onClick={onClose}>
      <div className="switcher" onClick={(e) => e.stopPropagation()}>
        <h3>Your games</h3>
        {games.length === 0 && <p className="hint">No active games yet. Host or join one below.</p>}
        <ul className="switcher-list">
          {games.map((g) => (
            <li key={g.code} className={g.code === currentRoom ? 'current' : ''}>
              <div className="switcher-main">
                <strong>{g.code}</strong>
                <span className={`switcher-phase ${g.yourTurn ? 'your-turn' : ''}`}>{phaseLabel(g)}</span>
              </div>
              <div className="hint switcher-players">
                {g.playerCount === 1 ? 'Solo' : `${g.playerCount} players`}: {g.players.join(', ')}
              </div>
              <div className="switcher-actions">
                {g.code === currentRoom ? (
                  <span className="hint">viewing now</span>
                ) : (
                  <button onClick={() => onResume(g.code)}>Resume</button>
                )}
                <button
                  className="switcher-abandon"
                  onClick={() => {
                    if (confirm(`Abandon game ${g.code}? You will leave it for good.`)) onAbandon(g.code);
                  }}
                >
                  Abandon
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="switcher-foot">
          <button className="primary" onClick={onNew}>
            + Host or join another game
          </button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
