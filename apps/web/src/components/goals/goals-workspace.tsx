'use client';

import { formatInr, type FireProjection, type GoalProjection } from '@finmanager/core';
import { useState } from 'react';

import { Amount } from '@/components/amount';
import { useInitialSkeleton, WorkspaceSkeleton } from '@/components/motion/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardLabel, CardTitle } from '@/components/ui/card';
import { useGoals } from '@/lib/goals';

import { FireSettingsForm } from './fire-settings-form';
import { GoalForm } from './goal-form';

const STATUS_LABEL: Record<GoalProjection['status'], string> = {
  achieved: 'Achieved',
  on_track: 'On track',
  off_track: 'Off track',
};

const STATUS_CLASS: Record<GoalProjection['status'], string> = {
  achieved: 'text-gain',
  on_track: 'text-gain',
  off_track: 'text-loss',
};

function StatusPill({ status }: { status: GoalProjection['status'] }) {
  return (
    <span className={`font-body text-label ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
  );
}

function ProgressBar({ ratio }: { ratio: number }) {
  const percent = Math.max(0, Math.min(100, ratio * 100));
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

export function GoalsWorkspace() {
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
      <div>
        <h1 className="font-display text-headline-lg text-foreground">Goals &amp; FIRE</h1>
        <p className="font-body text-body-md text-foreground-muted">
          Inflation-adjusted targets, the SIP to close each gap, and your path to financial
          independence.
        </p>
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
          <CardLabel>FIRE number</CardLabel>
          <Amount value={fire.fireNumber} size="section" />
          <p className="mt-1 font-body text-caption text-foreground-muted">
            {fire.fireNumber > 0
              ? `${(1 / (api.fireSettings.withdrawalRate / 100)).toFixed(0)}x annual expenses`
              : 'Set expenses to compute'}
          </p>
        </Card>
        <Card>
          <CardLabel>Current corpus</CardLabel>
          <Amount value={fire.currentCorpus} size="section" />
          <p className="mt-1 font-body text-caption text-foreground-muted">
            {fire.fireNumber > 0
              ? `${(fire.progress * 100).toFixed(0)}% of FIRE`
              : 'Net worth today'}
          </p>
          <ProgressBar ratio={fire.progress} />
        </Card>
        <Card>
          <CardLabel>Monthly savings</CardLabel>
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
          <CardLabel>Coast FIRE</CardLabel>
          <Amount value={fire.coastNumber} size="section" />
          <p className="mt-1 font-body text-caption text-foreground-muted">
            {fire.coastAchieved ? 'Reached: growth alone can coast' : 'Corpus needed to coast'}
          </p>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Path to FIRE</CardTitle>
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
                {variant.achieved ? 'Reached' : `${(variant.progress * 100).toFixed(0)}% funded`}
              </p>
              <ProgressBar ratio={variant.progress} />
            </div>
          ))}
        </div>
      </Card>

      {/* Goals */}
      <Card>
        <CardHeader>
          <CardTitle>Goals</CardTitle>
          <div className="flex items-center gap-3">
            <span className="font-body text-caption text-foreground-muted">
              {api.goals.length} tracked
            </span>
            {api.canWrite && !showForm ? (
              <Button
                size="sm"
                type="button"
                onClick={() => {
                  setEditing(null);
                  setShowForm(true);
                }}
              >
                Add goal
              </Button>
            ) : null}
          </div>
        </CardHeader>
        {showForm ? (
          <div className="mb-4">
            <GoalForm
              initial={editingGoal}
              holdings={api.holdings}
              onSave={async (goal) => {
                await api.saveGoal(goal);
                setShowForm(false);
                setNotice('Goal saved locally; sync will follow when online.');
              }}
              onCancel={() => setShowForm(false)}
            />
          </div>
        ) : null}
        {api.projections.length === 0 ? (
          <p className="font-body text-body-md text-foreground-muted">
            Add a goal to see its inflation-adjusted target and the monthly SIP to reach it.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {api.projections.map((projection) => (
              <div
                key={projection.goalId}
                className="flex flex-col gap-2 border-b border-border/60 pb-4 last:border-0 last:pb-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-body text-body-md text-foreground">{projection.name}</p>
                    <p className="font-body text-caption text-foreground-muted capitalize">
                      {projection.kind.replace('_', ' ')}
                      {projection.years > 0 ? ` · ${projection.years.toFixed(1)} yrs` : ''}
                    </p>
                  </div>
                  <StatusPill status={projection.status} />
                </div>
                <div className="grid gap-2 md:grid-cols-4">
                  <div>
                    <CardLabel>Future cost</CardLabel>
                    <p className="font-display text-title-md text-foreground">
                      {formatInr(projection.inflatedTarget)}
                    </p>
                  </div>
                  <div>
                    <CardLabel>Projected</CardLabel>
                    <p className="font-display text-title-md text-foreground">
                      {formatInr(projection.projectedValue)}
                    </p>
                  </div>
                  <div>
                    <CardLabel>{projection.gap > 0 ? 'Shortfall' : 'Surplus'}</CardLabel>
                    <p className="font-display text-title-md text-foreground">
                      {formatInr(projection.gap > 0 ? projection.gap : projection.surplus)}
                    </p>
                  </div>
                  <div>
                    <CardLabel>Monthly SIP needed</CardLabel>
                    <p className="font-display text-title-md text-foreground">
                      {formatInr(projection.requiredMonthlySip)}
                    </p>
                  </div>
                </div>
                <ProgressBar ratio={projection.fundingRatio} />
                {projection.missingLinkedValueCount > 0 || projection.missingLinkedFxCount > 0 ? (
                  <p className="font-body text-caption text-loss">
                    {projection.missingLinkedValueCount} linked holding(s) unvalued ·{' '}
                    {projection.missingLinkedFxCount} missing FX
                  </p>
                ) : null}
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => {
                      setEditing(projection.goalId);
                      setShowForm(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() =>
                      projection.goalId &&
                      void api
                        .deleteGoal(projection.goalId)
                        .then(() =>
                          setNotice('Goal deleted locally; sync will follow when online.'),
                        )
                    }
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Retirement corpus */}
      <Card>
        <CardHeader>
          <CardTitle>Retirement corpus</CardTitle>
          <span className="font-body text-caption text-foreground-muted">EPF · PPF · NPS</span>
        </CardHeader>
        <Amount value={api.retirement.total} size="section" />
        {api.retirement.rows.length === 0 ? (
          <p className="mt-2 font-body text-body-md text-foreground-muted">
            Add EPF, PPF, or NPS holdings in Portfolio to build your retirement corpus.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {api.retirement.rows.map((row) => (
              <div
                key={row.holdingId}
                className="flex items-center justify-between border-b border-border/60 pb-2 last:border-0"
              >
                <span className="font-body text-body-md text-foreground">
                  {row.name} <span className="text-foreground-muted uppercase">{row.type}</span>
                </span>
                <Amount value={row.value} />
              </div>
            ))}
          </div>
        )}
        {api.retirement.missingValueCount > 0 || api.retirement.missingFxCount > 0 ? (
          <p className="mt-2 font-body text-caption text-loss">
            {api.retirement.missingValueCount} unvalued · {api.retirement.missingFxCount} missing FX
          </p>
        ) : null}
      </Card>

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
