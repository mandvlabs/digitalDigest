import { useState } from 'react';
import { usePrefs } from '../../hooks/usePrefs.js';
import WelcomeStep from './WelcomeStep.jsx';
import BulgariaStep from './BulgariaStep.jsx';
import WorldStep from './WorldStep.jsx';
import SportsStep from './SportsStep.jsx';
import NotificationsStep from './NotificationsStep.jsx';

const STEPS = ['welcome', 'bulgaria', 'world', 'sports', 'notifications'];

export default function OnboardingWizard({ onFinish }) {
  const { prefs, update } = usePrefs();
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState({
    bulgariaOutlets: prefs?.bulgariaOutlets ?? [],
    worldTopics: prefs?.worldTopics ?? [],
    worldRegions: prefs?.worldRegions ?? [],
    footballTeams: prefs?.footballTeams ?? [],
    f1Follow: prefs?.f1Follow ?? false,
    notifications: prefs?.notifications ?? {
      bulgariaBreaking: false,
      worldBreaking: false,
      sportsBreaking: false,
    },
  });

  function patchDraft(patch) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  function next() {
    if (stepIndex < STEPS.length - 1) setStepIndex((i) => i + 1);
  }

  function back() {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  }

  async function finish() {
    await update({ ...draft, onboardingComplete: true });
    onFinish?.();
  }

  const step = STEPS[stepIndex];

  return (
    <div style={{ padding: 24, maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ color: '#888', fontSize: 12 }}>
        Step {stepIndex + 1} of {STEPS.length}
      </div>

      {step === 'welcome' && <WelcomeStep onNext={next} />}
      {step === 'bulgaria' && (
        <BulgariaStep
          selected={draft.bulgariaOutlets}
          onChange={(bulgariaOutlets) => patchDraft({ bulgariaOutlets })}
          onBack={back}
          onNext={next}
        />
      )}
      {step === 'world' && (
        <WorldStep
          selectedTopics={draft.worldTopics}
          selectedRegions={draft.worldRegions}
          onChangeTopics={(worldTopics) => patchDraft({ worldTopics })}
          onChangeRegions={(worldRegions) => patchDraft({ worldRegions })}
          onBack={back}
          onNext={next}
        />
      )}
      {step === 'sports' && (
        <SportsStep
          selectedTeams={draft.footballTeams}
          f1Follow={draft.f1Follow}
          onChangeTeams={(footballTeams) => patchDraft({ footballTeams })}
          onChangeF1={(f1Follow) => patchDraft({ f1Follow })}
          onBack={back}
          onNext={next}
        />
      )}
      {step === 'notifications' && (
        <NotificationsStep
          notifications={draft.notifications}
          onChange={(notifications) => patchDraft({ notifications })}
          onBack={back}
          onFinish={finish}
        />
      )}
    </div>
  );
}
