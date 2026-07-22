import type { AgeBand, CityClass } from '@finmanager/core';
import { AVAILABLE_FYS, formatInr } from '@finmanager/core';

import { Card, CardTitle } from '@/components/ui/card';
import { CheckField, CurrencyField, PercentField, SelectField } from '@/components/ui/input';
import type { ScenarioInput } from '@/lib/tax-scenario';

const AGE_OPTIONS: readonly { value: AgeBand; label: string }[] = [
  { value: 'below60', label: 'Below 60' },
  { value: 'senior', label: 'Senior (60 to 80)' },
  { value: 'superSenior', label: 'Super senior (80+)' },
];
const CITY_OPTIONS: readonly { value: CityClass; label: string }[] = [
  { value: 'metro', label: 'Metro' },
  { value: 'nonMetro', label: 'Non-metro' },
];

export type TaxMode = 'easy' | 'advanced';

export function TaxInputForm({
  mode,
  input,
  caps,
  onChange,
}: {
  readonly mode: TaxMode;
  readonly input: ScenarioInput;
  readonly caps: ReturnType<typeof import('@finmanager/core').rulesFor>['caps'];
  readonly onChange: <K extends keyof ScenarioInput>(key: K, value: ScenarioInput[K]) => void;
}): React.JSX.Element {
  return (
    <Card className="flex flex-col gap-5 self-start">
      <CardTitle>Your salary</CardTitle>
      <CurrencyField
        label="Annual CTC"
        value={input.ctc}
        onChange={(value) => onChange('ctc', value)}
        hint="Total cost to company, as printed on your offer letter."
      />
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Financial year"
          value={input.fy}
          options={AVAILABLE_FYS.map((fy) => ({ value: fy, label: `FY ${fy}` }))}
          onChange={(value) => onChange('fy', value)}
        />
        <SelectField
          label="City"
          value={input.cityClass}
          options={CITY_OPTIONS}
          onChange={(value) => onChange('cityClass', value)}
        />
      </div>
      <SelectField
        label="Age"
        value={input.ageBand}
        options={AGE_OPTIONS}
        onChange={(value) => onChange('ageBand', value)}
        hint="Only the old regime's exemption varies by age."
      />
      {mode === 'advanced' ? (
        <>
          <section className="flex flex-col gap-3 border-t border-border/50 pt-4">
            <p className="font-body text-label font-medium text-foreground">Salary composition</p>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ['basicRate', 'Basic (of CTC)'],
                  ['hraRate', 'HRA (of basic)'],
                  ['employerPfRate', 'Employer PF'],
                  ['employerNpsRate', 'Employer NPS'],
                  ['gratuityRate', 'Gratuity'],
                ] as const
              ).map(([key, label]) => (
                <PercentField
                  key={key}
                  label={label}
                  value={input[key]}
                  onChange={(value) => onChange(key, value)}
                />
              ))}
            </div>
          </section>
          <section className="flex flex-col gap-3 border-t border-border/50 pt-4">
            <p className="font-body text-label font-medium text-foreground">Deductions</p>
            <p className="font-body text-caption text-foreground-muted">
              The new regime allows none of these except employer NPS, so they only move the old
              regime&apos;s number.
            </p>
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
              max={caps.section80C}
              hint={`Capped at ${formatInr(caps.section80C)}. Your EPF is added automatically.`}
            />
            <CurrencyField
              label="80CCD(1B) NPS"
              value={input.section80CCD1B}
              onChange={(value) => onChange('section80CCD1B', value)}
              max={caps.section80CCD1B}
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
              max={caps.section80DPreventive}
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
              max={caps.professionalTaxMax}
              hint={`A state levy, capped at ${formatInr(caps.professionalTaxMax)} a year nationwide.`}
            />
          </section>
        </>
      ) : null}
    </Card>
  );
}
