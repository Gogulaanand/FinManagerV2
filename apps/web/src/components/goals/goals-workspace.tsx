'use client';

import {
  formatInr,
  formatPercent,
  ratioToPercent,
  swrMultiplier,
  type FireProjection,
} from '@finmanager/core';
import { useStatus } from '@powersync/react';
import { Compass, Flag, PiggyBank, Route, Sailboat, Target } from 'lucide-react';
import { useState } from 'react';

import { Amount } from '@/components/amount';
import { useInitialSkeleton, WorkspaceSkeleton } from '@/components/motion/skeleton';
import { useAuth } from '@/components/providers';
import { Card, CardHeader, CardLabel, CardTitle } from '@/components/ui/card';
import { useGoals } from '@/lib/goals';

import { FireSettingsForm } from './fire-settings-form';
import { GoalsList } from './goals-list';
import { RetirementSummary } from './retirement-summary';

/**
 * Hold the workspace behind the skeleton until the first PowerSync sync
 * completes, then mount the data-querying content. The queries must not mount
 * during the initial connect: they would attach to an empty local DB and render
 * zeros, and the live queries do not re-emit the rows that stream in afterwards
 * (only a remount re-attaches them). Signed-out users skip the wait.
 */
export function GoalsWorkspace() {
  const status = useStatus();
  const { session, loading: authLoading } = useAuth();
  if (authLoading || (session !== null && !status.hasSynced)) {
    return <WorkspaceSkeleton label="Loading goals" />;
  }
  return <GoalsWorkspaceContent />;
}

function ProgressBar({ ratio }: { ratio: number }) {
  const percent = Math.max(0, Math.min(100, ratioToPercent(ratio)));
  return (
    <div className="mt-2 h-2 rounded-full bg-surface-muted">
      <div className="h-2 rounded-full bg-primary" style={{ width: `${percent}%` }} />
    </div>
  );
}

function RequiredInvestment({ projection }: { projection: FireProjection }) {
  const { requiredMonthlyContribution, contributionGap, monthlyContribution } = projection;
  if (requiredMonthlyContribution === null) {
    return (
      <p className="mt-2 font-body text-caption text-foreground-muted">
        Set your current and target retirement age to see the monthly investment needed to reach
        FIRE.
      </p>
    );
  }
  // contributionGap is required − current: > 0 means a shortfall to close.
  const gap = contributionGap ?? 0;
  const onTrack = gap <= 0;
  return (
    <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-md border border-border/60 p-3">
      <div>
        <CardLabel>Monthly investment needed</CardLabel>
        <p className="font-display text-title-md text-foreground">
          {formatInr(requiredMonthlyContribution)}
        </p>
        <p className="font-body text-caption text-foreground-muted">
          to reach FIRE by your retirement age
        </p>
      </div>
      <div>
        <CardLabel>vs your {formatInr(monthlyContribution)}/mo</CardLabel>
        <p className={`font-display text-title-md ${onTrack ? 'text-gain' : 'text-loss'}`}>
          {onTrack ? 'On track' : `${formatInr(gap)} short`}
        </p>
        <p className="font-body text-caption text-foreground-muted">
          {onTrack
            ? 'Your current savings rate is enough'
            : 'Increase your monthly investment by this much'}
        </p>
      </div>
    </div>
  );
}

function fireStatusLabel(projection: FireProjection): string {
  if (projection.fireNumber <= 0) return 'Add your annual expenses to project FIRE';
  if (projection.status === 'achieved') return 'You have reached your FIRE number';
  if (projection.yearsToFire === null) return 'Unreachable at the current savings rate';
  const years = projection.yearsToFire;
  const age = projection.fireAge;
  const ageText = age === null ? '' : ` (around age ${age.toFixed(0)})`;
  return `About ${years.toFixed(1)} years to FIRE${ageText}`;
}

function GoalsWorkspaceContent() {
  const api = useGoals();
  const initialSkeleton = useInitialSkeleton();
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const editingGoal = api.goals.find((goal) => goal.id === editing) ?? null;

  if (api.loading || initialSkeleton) return <WorkspaceSkeleton label="Loading goals" />;

  const fire = api.fireProjection;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <span className="mt-1 inline-flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Target aria-hidden="true" size={21} />
        </span>
        <div>
          <h1 className="font-display text-headline-lg text-foreground">Goals &amp; FIRE</h1>
          <p className="font-body text-body-md text-foreground-muted">
            Inflation-adjusted targets, the SIP to close each gap, and your path to financial
            independence.
          </p>
        </div>
      </div>

      {!api.canWrite ? (
        <Card>
          <p className="font-body text-body-md text-foreground-muted">
            Sign in to save goals offline and sync them across devices.
          </p>
        </Card>
      ) : null}
      {notice ? <p className="font-body text-caption text-foreground-muted">{notice}</p> : null}

      {/* FIRE summary */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardLabel className="flex items-center gap-2">
            <Flag aria-hidden="true" size={15} />
            FIRE number
          </CardLabel>
          <Amount value={fire.fireNumber} size="section" />
          <p className="mt-1 font-body text-caption text-foreground-muted">
            {fire.fireNumber > 0
              ? `${swrMultiplier(api.fireSettings.withdrawalRate).toFixed(0)}x annual expenses`
              : 'Set expenses to compute'}
          </p>
        </Card>
        <Card>
          <CardLabel className="flex items-center gap-2">
            <PiggyBank aria-hidden="true" size={15} />
            Current corpus
          </CardLabel>
          <Amount value={fire.currentCorpus} size="section" />
          <p className="mt-1 font-body text-caption text-foreground-muted">
            {fire.fireNumber > 0 ? `${formatPercent(fire.progress, 0)} of FIRE` : 'Net worth today'}
          </p>
          <ProgressBar ratio={fire.progress} />
        </Card>
        <Card>
          <CardLabel className="flex items-center gap-2">
            <Compass aria-hidden="true" size={15} />
            Monthly savings
          </CardLabel>
          <Amount value={api.monthlyContribution} size="section" />
          <p className="mt-1 font-body text-caption text-foreground-muted">
            {api.fireSettings.monthlyInvestment !== null
              ? 'The monthly investment you set below'
              : api.derivedMonthlySavings > 0
                ? 'Recent income minus expenses, per month'
                : 'No income logged yet; set a monthly investment below'}
          </p>
        </Card>
        <Card>
          <CardLabel className="flex items-center gap-2">
            <Sailboat aria-hidden="true" size={15} />
            Coast FIRE
          </CardLabel>
          <Amount value={fire.coastNumber} size="section" />
          <p className="mt-1 font-body text-caption text-foreground-muted">
            {fire.coastAchieved ? 'Reached: growth alone can coast' : 'Corpus needed to coast'}
          </p>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route aria-hidden="true" size={18} className="text-primary" />
            Path to FIRE
          </CardTitle>
          <StatusPillFire projection={fire} />
        </CardHeader>
        <p className="font-body text-body-md text-foreground">{fireStatusLabel(fire)}</p>
        {fire.fireNumber > 0 ? <RequiredInvestment projection={fire} /> : null}
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {fire.variants.map((variant) => (
            <div key={variant.key} className="rounded-md border border-border/60 p-3">
              <p className="font-body text-label text-foreground-muted capitalize">
                {variant.key} FIRE
              </p>
              <p className="font-display text-title-md text-foreground">
                {formatInr(variant.target)}
              </p>
              <p className="font-body text-caption text-foreground-muted">
                {variant.achieved ? 'Reached' : `${formatPercent(variant.progress, 0)} funded`}
              </p>
              <ProgressBar ratio={variant.progress} />
            </div>
          ))}
        </div>
      </Card>

      <GoalsList
        goals={api.projections}
        trackedGoalCount={api.goals.length}
        canWrite={api.canWrite}
        showForm={showForm}
        editingGoal={editingGoal}
        holdings={api.holdings}
        onAdd={() => {
          setEditing(null);
          setShowForm(true);
        }}
        onSave={async (goal) => {
          await api.saveGoal(goal);
          setShowForm(false);
          setNotice('Goal saved locally; sync will follow when online.');
        }}
        onCancel={() => setShowForm(false)}
        onEdit={(goalId) => {
          setEditing(goalId);
          setShowForm(true);
        }}
        onDelete={(goalId) =>
          void api
            .deleteGoal(goalId)
            .then(() => setNotice('Goal deleted locally; sync will follow when online.'))
            .catch(() => setNotice('Could not delete the goal. Please try again.'))
        }
      />

      <RetirementSummary retirement={api.retirement} />

      {api.canWrite ? (
        <FireSettingsForm
          initial={api.fireSettings}
          onSave={async (settings) => {
            await api.saveFireSettings(settings);
          }}
        />
      ) : null}
    </div>
  );
}

function StatusPillFire({ projection }: { projection: FireProjection }) {
  if (projection.fireNumber <= 0) return null;
  const label =
    projection.status === 'achieved'
      ? 'Achieved'
      : projection.status === 'on_track'
        ? 'On track'
        : 'Off track';
  const className = projection.status === 'off_track' ? 'text-loss' : 'text-gain';
  return <span className={`font-body text-label ${className}`}>{label}</span>;
}
