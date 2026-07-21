'use client';

import { formatInr, ratioToPercent, type GoalProjection } from '@finmanager/core';
import type { Goal, Holding } from '@finmanager/schema';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';

import { GoalForm } from './goal-form';

interface GoalsListProps {
  readonly goals: readonly GoalProjection[];
  readonly trackedGoalCount: number;
  readonly canWrite: boolean;
  readonly showForm: boolean;
  readonly editingGoal: Goal | null;
  readonly holdings: readonly Holding[];
  readonly onAdd: () => void;
  readonly onSave: (goal: Goal) => Promise<void>;
  readonly onCancel: () => void;
  readonly onEdit: (goalId: string) => void;
  readonly onDelete: (goalId: string) => void;
}

function StatusPill({ status }: { status: GoalProjection['status'] }) {
  const label =
    status === 'achieved' ? 'Achieved' : status === 'on_track' ? 'On track' : 'Off track';
  const className = status === 'off_track' ? 'text-loss' : 'text-gain';
  return <span className={`font-body text-label ${className}`}>{label}</span>;
}

function ProgressBar({ ratio }: { ratio: number }) {
  const percent = Math.max(0, Math.min(100, ratioToPercent(ratio)));
  return (
    <div className="mt-2 h-2 rounded-full bg-surface-muted">
      <div className="h-2 rounded-full bg-primary" style={{ width: `${percent}%` }} />
    </div>
  );
}

export function GoalsList({
  goals,
  trackedGoalCount,
  canWrite,
  showForm,
  editingGoal,
  holdings,
  onAdd,
  onSave,
  onCancel,
  onEdit,
  onDelete,
}: GoalsListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Goals</CardTitle>
        <div className="flex items-center gap-3">
          <span className="font-body text-caption text-foreground-muted">
            {trackedGoalCount} tracked
          </span>
          {canWrite && !showForm ? (
            <Button size="sm" type="button" onClick={onAdd}>
              Add goal
            </Button>
          ) : null}
        </div>
      </CardHeader>
      {showForm ? (
        <div className="mb-4">
          <GoalForm initial={editingGoal} holdings={holdings} onSave={onSave} onCancel={onCancel} />
        </div>
      ) : null}
      {goals.length === 0 ? (
        <p className="font-body text-body-md text-foreground-muted">
          Add a goal to see its inflation-adjusted target and the monthly SIP to reach it.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {goals.map((projection) => (
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
                  <p className="font-body text-label text-foreground-muted">Future cost</p>
                  <p className="font-display text-title-md text-foreground">
                    {formatInr(projection.inflatedTarget)}
                  </p>
                </div>
                <div>
                  <p className="font-body text-label text-foreground-muted">Projected</p>
                  <p className="font-display text-title-md text-foreground">
                    {formatInr(projection.projectedValue)}
                  </p>
                </div>
                <div>
                  <p className="font-body text-label text-foreground-muted">
                    {projection.gap > 0 ? 'Shortfall' : 'Surplus'}
                  </p>
                  <p className="font-display text-title-md text-foreground">
                    {formatInr(projection.gap > 0 ? projection.gap : projection.surplus)}
                  </p>
                </div>
                <div>
                  <p className="font-body text-label text-foreground-muted">Monthly SIP needed</p>
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
                  onClick={() => projection.goalId && onEdit(projection.goalId)}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => projection.goalId && onDelete(projection.goalId)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
