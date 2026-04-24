import { isStandalone, isIos } from '../../utils/standalone.js';

export default function InstallHint() {
  if (isStandalone()) return null;
  const ios = isIos();
  return (
    <div
      style={{
        border: '1px solid #e3e3e3',
        background: '#fafafa',
        padding: 12,
        borderRadius: 8,
        fontSize: 16,
        color: '#333',
      }}
    >
      {ios ? (
        <>
          <strong>Install to Home Screen</strong>
          <div style={{ marginTop: 4 }}>
            Tap the Share button, then <em>Add to Home Screen</em>.
            Push notifications on iOS only work from the installed app.
          </div>
        </>
      ) : (
        <>
          <strong>Install Daily Family Digest</strong>
          <div style={{ marginTop: 4 }}>
            Use your browser's install option for the best experience.
          </div>
        </>
      )}
    </div>
  );
}
