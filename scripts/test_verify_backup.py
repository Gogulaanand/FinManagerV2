import unittest
from verify_backup import compare_rows, dump_tables


class BackupVerificationTests(unittest.TestCase):
    def test_copy_records_preserve_escapes_nulls_and_order_independence(self):
        dump = 'COPY public.accounts (id, current_balance, note) FROM stdin;\na\t100.25\tline\\nnext\nb\t-5\t\\N\n\\.\n'
        table, columns, rows = dump_tables(dump)[0]
        self.assertEqual(table, 'public.accounts')
        self.assertEqual(columns, ['id', 'current_balance', 'note'])
        self.assertTrue(compare_rows(rows, list(reversed(rows))))
        self.assertFalse(compare_rows(rows, ['a\t99.25\tline\\nnext', 'b\t-4\t\\N']))
        self.assertFalse(compare_rows(rows, rows + [rows[0]]))

    def test_rejects_empty_truncated_or_unsafe_copy(self):
        for dump in ['', 'COPY public.accounts (id) FROM stdin;\na', 'COPY public.accounts (id); DROP TABLE accounts; --) FROM stdin;\n\\.']:
            with self.assertRaises(ValueError):
                dump_tables(dump)


if __name__ == '__main__':
    unittest.main()
