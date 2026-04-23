import HomeSection from './HomeSection.jsx';

export default function HomeTab({ onNavigate }) {
  return (
    <section style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
      <header style={{ padding: '16px 16px 8px' }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Today's digest</h1>
      </header>
      <HomeSection
        title="Top from Bulgaria"
        section="bulgaria"
        onSeeAll={() => onNavigate?.('bulgaria')}
      />
      <HomeSection
        title="Top from the World"
        section="world"
        onSeeAll={() => onNavigate?.('world')}
      />
      <HomeSection
        title="Top from Sports"
        section="sports"
        onSeeAll={() => onNavigate?.('sports')}
      />
    </section>
  );
}
