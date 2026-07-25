import { describe, expect, it } from 'vitest';

import {
  buildDisclosureMessage,
  buildReminderMessage,
  buildSummary,
  daysUntilNextStage,
  describeDays,
  presentableSummary,
  summaryLabel,
} from './messages.js';

describe('describeDays', () => {
  it('agrees in number so a reminder never reads "1 days"', () => {
    expect(describeDays(1)).toBe('1 day');
    expect(describeDays(0)).toBe('0 days');
    expect(describeDays(15)).toBe('15 days');
  });
});

describe('daysUntilNextStage', () => {
  it('counts forward from current inactivity, not the successor threshold', () => {
    // Earlier copy said "in 8 days" at this point, which is the absolute
    // threshold rather than the time the reader actually has.
    expect(daysUntilNextStage(1, 'reminder_1', 1)).toBe(7);
    expect(daysUntilNextStage(1, 'reminder_2', 8)).toBe(7);
    expect(daysUntilNextStage(1, 'reminder_3', 15)).toBe(7);
  });

  it('has no successor after the disclosure', () => {
    expect(daysUntilNextStage(1, 'disclosure', 22)).toBeNull();
  });

  it('never promises a deadline in the past when a reminder fires late', () => {
    expect(daysUntilNextStage(1, 'reminder_1', 10)).toBe(0);
    expect(daysUntilNextStage(30, 'reminder_1', 34)).toBe(3);
  });
});

describe('summary presentation', () => {
  it('never leaks an internal namespacing key into a disclosure', () => {
    // A live 2026-07-25 disclosure read "account:bank: INR 80,000".
    expect(summaryLabel({ source: 'account', type: 'bank', value: 1 })).toBe('Bank accounts');
    expect(summaryLabel({ source: 'holding', type: 'mutual_fund', value: 1 })).toBe('Mutual funds');
    expect(summaryLabel({ source: 'holding', type: 'cash', value: 1 })).toBe('Cash');
    expect(summaryLabel({ source: 'account', type: 'cash', value: 1 })).toBe('Cash on hand');
    expect(summaryLabel({ source: 'holding', type: 'sovereign_bond', value: 1 })).toBe(
      'Sovereign bond',
    );
  });

  it('omits empty asset classes and leads with the largest', () => {
    expect(
      presentableSummary([
        { source: 'holding', type: 'stock', value: 0 },
        { source: 'account', type: 'bank', value: 80_000 },
        { source: 'holding', type: 'gold', value: 250_000 },
      ]),
    ).toEqual([
      { label: 'Gold', value: 250_000 },
      { label: 'Bank accounts', value: 80_000 },
    ]);
    expect(presentableSummary([{ source: 'holding', type: 'stock', value: 0 }])).toEqual([]);
  });

  it('keeps holdings and accounts apart where their vocabularies overlap', () => {
    const summary = buildSummary(
      [
        { type: 'cash', value: 5_000 },
        { type: 'cash', value: 1_000 },
      ],
      [{ type: 'cash', value: 900 }],
    );
    expect(summary).toEqual([
      { source: 'holding', type: 'cash', value: 6_000 },
      { source: 'account', type: 'cash', value: 900 },
    ]);
  });

  it('clamps a negative class to zero rather than subtracting from the total', () => {
    expect(buildSummary([], [{ type: 'credit_card', value: -4_000 }])).toEqual([
      { source: 'account', type: 'credit_card', value: 0 },
    ]);
  });
});

describe('buildDisclosureMessage', () => {
  const summary = [{ source: 'account', type: 'bank', value: 80_000 }] as const;

  it('discloses only existence when that is the contact scope', () => {
    const message = buildDisclosureMessage({
      userName: 'asha@example.com',
      scope: 'existence',
      note: null,
      summary,
    });
    expect(message.text).toContain('Financial records exist in FinManager');
    // The whole point of the narrower scope: no figures reach this reader.
    expect(message.text).not.toContain('80,000');
  });

  it('includes labelled figures for the summary scope', () => {
    const message = buildDisclosureMessage({
      userName: 'asha@example.com',
      scope: 'summary',
      note: '  Please call my sister.  ',
      summary,
    });
    expect(message.text).toContain('- Bank accounts: INR 80,000');
    expect(message.text).toContain('Message from the user:\nPlease call my sister.');
    expect(message.text).not.toContain('account:bank');
  });

  it('omits the note block entirely when the note is blank or whitespace', () => {
    for (const note of [null, '', '   ']) {
      const message = buildDisclosureMessage({
        userName: 'asha@example.com',
        scope: 'summary',
        note,
        summary,
      });
      expect(message.text).not.toContain('Message from the user');
    }
  });

  it('says so plainly when there is nothing to summarise', () => {
    const message = buildDisclosureMessage({
      userName: 'asha@example.com',
      scope: 'summary',
      note: null,
      summary: [],
    });
    expect(message.text).toContain('- No summary is available.');
  });

  it('escapes the note so a contact cannot be sent injected markup', () => {
    const message = buildDisclosureMessage({
      userName: 'asha@example.com',
      scope: 'summary',
      note: '<script>alert(1)</script>',
      summary,
    });
    expect(message.html).not.toContain('<script>');
    expect(message.html).toContain('&lt;script&gt;');
  });
});

describe('buildReminderMessage', () => {
  it('names the contacts only in the final reminder', () => {
    const base = {
      userName: 'asha@example.com',
      inactiveDays: 1,
      thresholdDays: 1,
      contactNames: ['Asha', 'Ravi'],
    };
    expect(buildReminderMessage({ ...base, stage: 'reminder_1' }).text).not.toContain('Asha');
    const last = buildReminderMessage({ ...base, stage: 'reminder_3', inactiveDays: 15 });
    expect(last.text).toContain('Asha, Ravi');
    expect(last.text).toContain('we will notify your trusted contacts');
  });

  it('falls back to a generic phrase when no contact is named', () => {
    expect(
      buildReminderMessage({
        userName: 'asha@example.com',
        stage: 'reminder_3',
        inactiveDays: 15,
        thresholdDays: 1,
        contactNames: [],
      }).text,
    ).toContain('your active trusted contacts');
  });

  it('reads naturally at the boundaries', () => {
    expect(
      buildReminderMessage({
        userName: 'a@b.com',
        stage: 'reminder_1',
        inactiveDays: 1,
        thresholdDays: 1,
        contactNames: [],
      }).text,
    ).toContain('for 1 day. If you do not open the app, we will remind you again in 7 days.');
    // Threshold 7 puts reminder_2 one day out at 13 days of inactivity.
    expect(
      buildReminderMessage({
        userName: 'a@b.com',
        stage: 'reminder_1',
        inactiveDays: 13,
        thresholdDays: 7,
        contactNames: [],
      }).text,
    ).toContain('we will remind you again tomorrow');
  });
});
