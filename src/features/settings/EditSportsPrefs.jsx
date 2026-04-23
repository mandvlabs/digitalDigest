import { usePrefs } from '../../hooks/usePrefs.js';
import { LEAGUES, TEAMS } from '../../services/teams.js';

export default function EditSportsPrefs() {
  const { prefs, update } = usePrefs();
  const teams = new Set(prefs?.footballTeams || []);
  const f1 = !!prefs?.f1Follow;

  async function toggleTeam(id) {
    const next = new Set(teams);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    await update({ footballTeams: [...next] });
  }
  async function toggleF1() {
    await update({ f1Follow: !f1 });
  }

  return (
    <details>
      <summary style={{ cursor: 'pointer', padding: '8px 0' }}>
        Sports ({teams.size} teams{f1 ? ' + F1' : ''})
      </summary>
      <div style={{ padding: '8px 0' }}>
        <label style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input type="checkbox" checked={f1} onChange={toggleF1} />
          <span>Follow Formula 1</span>
        </label>
        {LEAGUES.map((league) => (
          <div key={league.id} style={{ marginBottom: 10 }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 13 }}>{league.name}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {TEAMS.filter((t) => t.leagueId === league.id).map((t) => (
                <label key={t.id} style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={teams.has(t.id)}
                    onChange={() => toggleTeam(t.id)}
                  />
                  <span>{t.name}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
