import { TaxCalculator } from '@/components/tax/tax-calculator';

export const metadata = {
  title: 'Tax | FinManager',
  description: 'Old vs new regime comparison and monthly in-hand salary for India.',
};

export default function TaxPage() {
  return <TaxCalculator />;
}
