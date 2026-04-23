import { Home, Newspaper, Globe, Trophy, Settings } from 'lucide-react';

const TABS = [
  { key: 'home',     label: 'Home',     Icon: Home },
  { key: 'bulgaria', label: 'Bulgaria', Icon: Newspaper },
  { key: 'world',    label: 'World',    Icon: Globe },
  { key: 'sports',   label: 'Sports',   Icon: Trophy },
  { key: 'settings', label: 'Settings', Icon: Settings },
];

export default function TabBar({ active, onChange }) {
  return (
    <nav
      style={{
        display: 'flex',
        justifyContent: 'space-around',
        borderTop: '1px solid #e5e5e5',
        background: '#fff',
        padding: '8px 0 calc(8px + env(safe-area-inset-bottom))',
      }}
    >
      {TABS.map(({ key, label, Icon }) => (
        <button
          key={key}
          aria-current={active === key ? 'page' : undefined}
          onClick={() => onChange(key)}
          style={{
            background: 'none',
            border: 'none',
            color: active === key ? '#111' : '#888',
            fontSize: 12,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            minWidth: 60,
            cursor: 'pointer',
          }}
        >
          <Icon size={20} aria-hidden={true} />
          {label}
        </button>
      ))}
    </nav>
  );
}
