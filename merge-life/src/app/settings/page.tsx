'use client';

import { useRef, useState } from 'react';
import { AppShell } from '@/components/ui/AppShell';
import { Button, Card, SectionTitle, classNames } from '@/components/ui';
import { exportFileName, exportSaveToJson, parseSaveJson } from '@/db/repositories';
import { SESSION_LENGTH_OPTIONS } from '@/game/sessionEngine';
import { useGameStore } from '@/state/gameStore';
import type { SessionLengthMinutes } from '@/types';

export default function SettingsPage() {
  const status = useGameStore((state) => state.status);
  const save = useGameStore((state) => state.save);
  const updateSettings = useGameStore((state) => state.updateSettings);
  const importSave = useGameStore((state) => state.importSave);
  const resetAll = useGameStore((state) => state.resetAll);
  const loadSeed = useGameStore((state) => state.loadSeed);
  const pushToast = useGameStore((state) => state.pushToast);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [limitNotice, setLimitNotice] = useState(false);

  if (status !== 'ready') {
    return (
      <AppShell title="Settings" backHref="/">
        <p className="text-ink-soft">Loading your settings…</p>
      </AppShell>
    );
  }

  const settings = save.settings;

  const setLimit = (value: number) => {
    updateSettings({ maxSessionsPerDay: value });
    setLimitNotice(value > 2);
  };

  const doExport = () => {
    const json = exportSaveToJson(save);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = exportFileName();
    anchor.click();
    URL.revokeObjectURL(url);
    pushToast('Save exported to a JSON file.', 'success');
  };

  const doImport = async (file: File) => {
    try {
      const text = await file.text();
      const imported = parseSaveJson(text);
      await importSave(imported);
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : 'That file could not be read as a save.',
        'gentle',
      );
    }
  };

  return (
    <AppShell title="Settings" backHref="/" backLabel="My Life Workshop">
      <div className="space-y-6">
        <Card>
          <SectionTitle hint="The timer only ever starts when you press begin.">
            Session length
          </SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            {SESSION_LENGTH_OPTIONS.map((option) => (
              <ToggleButton
                key={option.minutes}
                active={settings.preferredSessionMinutes === option.minutes}
                onClick={() =>
                  updateSettings({
                    preferredSessionMinutes: option.minutes as SessionLengthMinutes,
                  })
                }
              >
                {option.label}
                <span className="block text-sm font-normal text-ink-soft">
                  {option.minutes} minutes
                </span>
              </ToggleButton>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle hint="Two a day by default. You are free to change it.">
            Sessions per day
          </SectionTitle>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((value) => (
              <ToggleButton
                key={value}
                active={settings.maxSessionsPerDay === value}
                onClick={() => setLimit(value)}
              >
                {value}
              </ToggleButton>
            ))}
          </div>
          {limitNotice || settings.maxSessionsPerDay > 2 ? (
            <p className="mt-3 text-sm text-ink-soft">
              Longer access may make it harder to keep play intentional.
            </p>
          ) : null}
          <p className="mt-2 text-sm text-ink-soft">
            After your sessions are used, the workshop stays open in viewing mode: browse your
            bench, your collection and your stats, and export your save.
          </p>
        </Card>

        <Card>
          <SectionTitle hint="Sound is off by default.">Accessibility and feedback</SectionTitle>
          <ul className="divide-y divide-line/70">
            <SettingSwitch
              label="Reduced motion"
              description="Animations become near-instant across the whole game."
              checked={settings.reducedMotion}
              onChange={(value) => updateSettings({ reducedMotion: value })}
            />
            <SettingSwitch
              label="High contrast"
              description="Stronger borders and darker text throughout."
              checked={settings.highContrast}
              onChange={(value) => updateSettings({ highContrast: value })}
            />
            <SettingSwitch
              label="Sound"
              description="Short, soft tones on merges and completed orders."
              checked={settings.soundEnabled}
              onChange={(value) => updateSettings({ soundEnabled: value })}
            />
            <SettingSwitch
              label="Haptics"
              description="A light tap on supported phones when parts merge."
              checked={settings.hapticsEnabled}
              onChange={(value) => updateSettings({ hapticsEnabled: value })}
            />
          </ul>
        </Card>

        <Card>
          <SectionTitle hint="Your save lives on this device only. There is no account and no server.">
            Your save
          </SectionTitle>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={doExport}>
              Export save to JSON
            </Button>
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              Import save from JSON
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void doImport(file);
                event.target.value = '';
              }}
            />
          </div>

          <div className="mt-5 border-t border-line/70 pt-4">
            {confirmReset ? (
              <div>
                <p className="font-medium text-ink">
                  Reset everything? Your board, collection and history will be cleared.
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  This cannot be undone. Export your save first if you might want it back.
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button
                    variant="primary"
                    onClick={() => {
                      setConfirmReset(false);
                      void resetAll();
                    }}
                  >
                    Yes, reset my progress
                  </Button>
                  <Button variant="quiet" onClick={() => setConfirmReset(false)}>
                    Keep my progress
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="quiet" onClick={() => setConfirmReset(true)}>
                Reset progress…
              </Button>
            )}
          </div>

          {process.env.NODE_ENV !== 'production' ? (
            <div className="mt-5 border-t border-line/70 pt-4">
              <p className="ml-label mb-2">Development only</p>
              <Button variant="secondary" onClick={() => void loadSeed()}>
                Load seeded demo save
              </Button>
              <p className="mt-2 text-sm text-ink-soft">
                Replaces your current save with a deterministic demo: a part-built board, two
                finished watches, some upgrades and previous sessions.
              </p>
            </div>
          ) : null}
        </Card>

        <Card>
          <SectionTitle>What this game will never do</SectionTitle>
          <ul className="grid gap-1.5 text-sm text-ink-soft sm:grid-cols-2">
            {[
              'Daily streaks',
              'Expiring rewards',
              'Loot boxes',
              'Premium currency',
              'Energy timers',
              'Adverts',
              'Shopping links',
              'Fear of missing out',
              'Punishing you for breaks',
              'Asking you to play again',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span aria-hidden="true">·</span>
                {item}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={classNames(
        'ml-touch rounded-2xl border px-3 py-3 text-center text-sm font-semibold transition-colors duration-200 ease-calm',
        active
          ? 'border-2 border-ink bg-surface-sunken/60 text-ink'
          : 'border-line bg-surface-raised text-ink-soft hover:bg-surface-sunken/40',
      )}
    >
      {children}
    </button>
  );
}

function SettingSwitch({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-ink">{label}</p>
        <p className="text-sm text-ink-soft">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={classNames(
          'ml-touch relative flex h-11 w-[76px] shrink-0 items-center rounded-pill border px-1 transition-colors duration-200 ease-calm',
          checked ? 'border-ink bg-ink' : 'border-line bg-surface-sunken',
        )}
      >
        <span
          className={classNames(
            'inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-raised text-xs font-bold text-ink transition-transform duration-200 ease-calm',
            checked ? 'translate-x-[36px]' : 'translate-x-0',
          )}
          aria-hidden="true"
        >
          {checked ? 'On' : 'Off'}
        </span>
      </button>
    </li>
  );
}
