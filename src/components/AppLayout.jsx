import TabBar from './TabBar.jsx';

export default function AppLayout({ activeTab, onTabChange, children }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        minHeight: 0,
      }}
    >
      <main style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{children}</main>
      <TabBar active={activeTab} onChange={onTabChange} />
    </div>
  );
}
