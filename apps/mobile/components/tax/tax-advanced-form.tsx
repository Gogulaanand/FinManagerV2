import { formatInr } from '@finmanager/core';
import { Text } from 'react-native';
import { Card, CardTitle } from '../card';
import { CheckField, CurrencyField, PercentField } from '../field';
import type { ScenarioInput } from '../../lib/tax-scenario';

export function TaxAdvancedForm({
  input,
  caps,
  onChange,
}: {
  readonly input: ScenarioInput;
  readonly caps: ReturnType<typeof import('@finmanager/core').rulesFor>['caps'];
  readonly onChange: <K extends keyof ScenarioInput>(key: K, value: ScenarioInput[K]) => void;
}): React.JSX.Element {
  return (
    <>
      <Card className="gap-4">
        <CardTitle>Salary composition</CardTitle>
        {(
          [
            ['basicRate', 'Basic (of CTC)'],
            ['hraRate', 'HRA (of basic)'],
            ['employerPfRate', 'Employer PF (of basic)'],
            ['employerNpsRate', 'Employer NPS (of basic)'],
            ['gratuityRate', 'Gratuity (of basic)'],
          ] as const
        ).map(([key, label]) => (
          <PercentField
            key={key}
            label={label}
            value={input[key]}
            onChange={(value) => onChange(key, value)}
          />
        ))}
      </Card>
      <Card className="gap-4">
        <CardTitle>Deductions</CardTitle>
        <Text className="font-body text-caption text-foreground-muted">
          The new regime allows none of these except employer NPS, so they only move the old
          regime&apos;s number.
        </Text>
        <CurrencyField
          label="Annual rent paid"
          value={input.rentPaid}
          onChange={(value) => onChange('rentPaid', value)}
          hint="For the HRA exemption."
        />
        <CurrencyField
          label="80C investments"
          value={input.section80C}
          onChange={(value) => onChange('section80C', value)}
          hint={`Capped at ${formatInr(caps.section80C)}. Your EPF is added automatically.`}
        />
        <CurrencyField
          label="80CCD(1B) NPS"
          value={input.section80CCD1B}
          onChange={(value) => onChange('section80CCD1B', value)}
          hint={`Capped at ${formatInr(caps.section80CCD1B)}, over and above 80C.`}
        />
        <CurrencyField
          label="80D self and family"
          value={input.section80DSelf}
          onChange={(value) => onChange('section80DSelf', value)}
        />
        <CurrencyField
          label="80D parents"
          value={input.section80DParents}
          onChange={(value) => onChange('section80DParents', value)}
        />
        <CurrencyField
          label="Preventive health check-up"
          value={input.section80DPreventive}
          onChange={(value) => onChange('section80DPreventive', value)}
          hint={`Capped at ${formatInr(caps.section80DPreventive)}, inside the 80D limit.`}
        />
        <CheckField
          label="I am a senior citizen"
          checked={input.isSelfSenior}
          onChange={(value) => onChange('isSelfSenior', value)}
        />
        <CheckField
          label="My parents are senior citizens"
          checked={input.areParentsSenior}
          onChange={(value) => onChange('areParentsSenior', value)}
        />
        <CurrencyField
          label="Professional tax"
          value={input.professionalTax}
          onChange={(value) => onChange('professionalTax', value)}
          hint={`A state levy, capped at ${formatInr(caps.professionalTaxMax)} a year.`}
        />
      </Card>
    </>
  );
}
