import { LEAGUES, teamsByLeague } from '../../services/teams.js';

function toggle(list, value) {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

export default function SportsStep({
  selectedTeams,
  f1Follow,
  onChangeTeams,
  onChangeF1,
  onBack,
  onNext,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 style={{ margin: 0 }}>Sports</h1>
      <p style={{ color: '#666' }}>Optional — skip if you don't follow sports.</p>

      <section>
        <h2 style={{ fontSize: 16, margin: '0 0 4px' }}>Football teams</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {LEAGUES.map((l) => (
            <details key={l.id} open>
              <summary style={{ fontWeight: 600, cursor: 'pointer' }}>{l.name}</summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0 0 12px' }}>
                {teamsByLeague(l.id).map((t) => (
                  <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={selectedTeams.includes(t.id)}
                      onChange={() => onChangeTeams(toggle(selectedTeams, t.id))}
                    />
                    {t.name}
                  </label>
                ))}
              </div>
            </details>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 16, margin: '0 0 4px' }}>Formula 1</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={f1Follow}
            onChange={(e) => onChangeF1(e.target.checked)}
          />
          Follow Formula 1
        </label>
      </section>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
        <button onClick={onBack}>Back</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onNext}>Skip</button>
          <button onClick={onNext}>Next</button>
        </div>
      </div>
    </div>
  );
}
