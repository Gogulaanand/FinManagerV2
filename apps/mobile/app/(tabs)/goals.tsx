import { formatInr, type FireProjection, type GoalProjection } from '@finmanager/core';
import { useStatus } from '@powersync/react';
import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Amount } from '../../components/amount';
import { Card, CardLabel, CardTitle } from '../../components/card';
import { Fab } from '../../components/fab';
import { MobileFireSettingsForm } from '../../components/goals/fire-settings-form';
import { MobileWorkspaceSkeleton, useInitialSkeleton } from '../../components/motion';
import { useAuth } from '../../components/providers';
import { useGoals } from '../../lib/goals';
import { setNotice, useNotice } from '../../lib/notice';

const STATUS_LABEL: Record<GoalProjection['status'], string> = {
  achieved: 'Achieved',
  on_track: 'On track',
  off_track: 'Off track',
};

function statusClass(status: GoalProjection['status']): string {
  return status === 'off_track' ? 'text-loss' : 'text-gain';
}

function ProgressBar({ ratio }: { ratio: number }) {
  const percent = Math.max(0, Math.min(100, ratio * 100));
  return (
    <View className="mt-2 h-2 rounded-full bg-surface-muted">
      <View className="h-2 rounded-full bg-primary" style={{ width: `${percent}%` }} />
    </View>
  );
}

function RequiredInvestment({ projection }: { projection: FireProjection }) {
  const { requiredMonthlyContribution, contributionGap, monthlyContribution } = projection;
  if (requiredMonthlyContribution === null) {
    return (
      <Text className="mt-2 font-body text-caption text-foreground-muted">
        Set your current and target retirement age to see the monthly investment needed.
      </Text>
    );
  }
  const gap = contributionGap ?? 0;
  const onTrack = gap <= 0;
  return (
    <View className="mt-3 gap-2 rounded-md border border-border/60 p-3">
      <View className="flex-row items-center justify-between">
        <CardLabel>Monthly investment needed</CardLabel>
        <Text className="font-display text-title-md text-foreground">
          {formatInr(requiredMonthlyContribution)}
        </Text>
      </View>
      <View className="flex-row items-center justify-between">
        <Text className="font-body text-caption text-foreground-muted">
          vs your {formatInr(monthlyContribution)}/mo
        </Text>
        <Text className={`font-body text-label ${onTrack ? 'text-gain' : 'text-loss'}`}>
          {onTrack ? 'On track' : `${formatInr(gap)} short`}
        </Text>
      </View>
    </View>
  );
}

function fireStatusText(projection: FireProjection): string {
  if (projection.fireNumber <= 0) return 'Add your annual expenses to project FIRE.';
  if (projection.status === 'achieved') return 'You have reached your FIRE number.';
  if (projection.yearsToFire === null) return 'Unreachable at the current savings rate.';
  const ageText =
    projection.fireAge === null ? '' : ` (around age ${projection.fireAge.toFixed(0)})`;
  return `About ${projection.yearsToFire.toFixed(1)} years to FIRE${ageText}.`;
}

// Mount the data-querying content only after the first PowerSync sync completes,
// so the queries read a populated local DB instead of attaching to an empty one
// during the initial connect (which renders zeros and does not self-correct
// without a remount). Signed-out users skip the wait.
export default function GoalsScreen() {
  const status = useStatus();
  const { session, loading: authLoading } = useAuth();
  if (authLoading || (session !== null && !status.hasSynced)) {
    return <MobileWorkspaceSkeleton label="Loading goals" />;
  }
  return <GoalsContent />;
}

function GoalsContent() {
  const api = useGoals();
  const initialSkeleton = useInitialSkeleton();
  const notice = useNotice();

  if (api.loading || initialSkeleton) return <MobileWorkspaceSkeleton label="Loading goals" />;

  const fire = api.fireProjection;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4 pb-28">
        <View className="flex-1">
          <Text className="font-display text-headline-lg text-foreground">Goals &amp; FIRE</Text>
          <Text className="font-body text-body-md text-foreground-muted">
            Targets, the SIP to close each gap, and your path to independence.
          </Text>
        </View>

        {!api.canWrite ? (
          <Card>
            <Text className="font-body text-body-md text-foreground-muted">
              Sign in to save goals offline and sync them across devices.
            </Text>
          </Card>
        ) : null}
        {notice ? (
          <Text className="font-body text-caption text-foreground-muted">{notice}</Text>
        ) : null}

        {/* FIRE summary */}
        <View className="gap-2">
          <View className="flex-row gap-2">
            <Card className="min-w-0 flex-1">
              <CardLabel>FIRE number</CardLabel>
              <Amount value={fire.fireNumber} size="tile" />
            </Card>
            <Card className="min-w-0 flex-1">
              <CardLabel>Current corpus</CardLabel>
              <Amount value={fire.currentCorpus} size="tile" />
              <Text className="font-body text-caption text-foreground-muted">
                {fire.fireNumber > 0 ? `${(fire.progress * 100).toFixed(0)}% of FIRE` : 'Net worth'}
              </Text>
            </Card>
          </View>
          <View className="flex-row gap-2">
            <Card className="min-w-0 flex-1">
              <CardLabel>Monthly savings</CardLabel>
              <Amount value={api.monthlyContribution} size="tile" />
              <Text className="font-body text-caption text-foreground-muted">
                {api.fireSettings.monthlyInvestment !== null
                  ? 'You set this'
                  : api.derivedMonthlySavings > 0
                    ? 'Income − expenses'
                    : 'Set it below'}
              </Text>
            </Card>
            <Card className="min-w-0 flex-1">
              <CardLabel>Coast FIRE</CardLabel>
              <Amount value={fire.coastNumber} size="tile" />
              <Text className="font-body text-caption text-foreground-muted">
                {fire.coastAchieved ? 'Reached' : 'To coast'}
              </Text>
            </Card>
          </View>
        </View>
        <Card>
          <CardTitle>Path to FIRE</CardTitle>
          <Text className="mt-2 font-body text-body-md text-foreground">
            {fireStatusText(fire)}
          </Text>
          {fire.fireNumber > 0 ? <RequiredInvestment projection={fire} /> : null}
          <View className="mt-3 gap-2">
            {fire.variants.map((variant) => (
              <View key={variant.key} className="flex-row items-center justify-between">
                <Text className="font-body text-body-md text-foreground capitalize">
                  {variant.key} FIRE
                </Text>
                <View className="items-end">
                  <Text className="font-display text-title-md text-foreground">
                    {formatInr(variant.target)}
                  </Text>
                  <Text className="font-body text-caption text-foreground-muted">
                    {variant.achieved ? 'Reached' : `${(variant.progress * 100).toFixed(0)}%`}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Card>

        {/* Goals */}
        <Card>
          <View className="mb-1 flex-row items-center justify-between">
            <CardTitle>Goals</CardTitle>
            <Text className="font-body text-caption text-foreground-muted">
              {api.goals.length} tracked
            </Text>
          </View>
          {api.projections.length === 0 ? (
            <Text className="font-body text-body-md text-foreground-muted">
              Add a goal to see its inflation-adjusted target and monthly SIP.
            </Text>
          ) : (
            <View className="gap-4">
              {api.projections.map((projection) => (
                <View key={projection.goalId} className="gap-2 border-b border-border/60 pb-3">
                  <View className="flex-row items-center justify-between">
                    <View className="min-w-0 flex-1">
                      <Text numberOfLines={1} className="font-body text-body-md text-foreground">
                        {projection.name}
                      </Text>
                      <Text className="font-body text-caption text-foreground-muted capitalize">
                        {projection.kind.replace('_', ' ')}
                        {projection.years > 0 ? ` · ${projection.years.toFixed(1)} yrs` : ''}
                      </Text>
                    </View>
                    <Text className={`font-body text-label ${statusClass(projection.status)}`}>
                      {STATUS_LABEL[projection.status]}
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <View>
                      <CardLabel>Future cost</CardLabel>
                      <Text className="font-display text-title-md text-foreground">
                        {formatInr(projection.inflatedTarget)}
                      </Text>
                    </View>
                    <View className="items-end">
                      <CardLabel>Monthly SIP</CardLabel>
                      <Text className="font-display text-title-md text-foreground">
                        {formatInr(projection.requiredMonthlySip)}
                      </Text>
                    </View>
                  </View>
                  <ProgressBar ratio={projection.fundingRatio} />
                  <View className="flex-row gap-2">
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.push(`/goal/${projection.goalId}` as Href)}
                      className="rounded-md bg-surface-muted px-3 py-2"
                    >
                      <Text className="font-body text-caption text-foreground">Edit</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        projection.goalId &&
                        void api
                          .deleteGoal(projection.goalId)
                          .then(() => setNotice('Goal deleted.'))
                      }
                      className="rounded-md bg-surface-muted px-3 py-2"
                    >
                      <Text className="font-body text-caption text-loss">Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Retirement corpus */}
        <Card>
          <CardTitle>Retirement corpus</CardTitle>
          <View className="mt-1">
            <Amount value={api.retirement.total} size="tile" />
          </View>
          {api.retirement.rows.length === 0 ? (
            <Text className="mt-2 font-body text-body-md text-foreground-muted">
              Add EPF, PPF, or NPS holdings in Portfolio to build your corpus.
            </Text>
          ) : (
            <View className="mt-3 gap-2">
              {api.retirement.rows.map((row) => (
                <View key={row.holdingId} className="flex-row items-center justify-between">
                  <Text className="font-body text-body-md text-foreground">
                    {row.name} <Text className="text-foreground-muted uppercase">{row.type}</Text>
                  </Text>
                  <Amount value={row.value} />
                </View>
              ))}
            </View>
          )}
        </Card>

        {api.canWrite ? (
          <MobileFireSettingsForm
            initial={api.fireSettings}
            onSave={async (settings) => {
              await api.saveFireSettings(settings);
            }}
          />
        ) : null}
      </ScrollView>
      <Fab
        icon="flag"
        label="Add goal"
        onPress={() => router.push('/goal/new' as Href)}
        disabled={!api.canWrite}
      />
    </SafeAreaView>
  );
}
