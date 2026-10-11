"""Known-answer numerical and topology tests, no model calls or downloaded fixtures."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('las_helper', Path(__file__).resolve().parents[2] / 'server/src/geo/well/las_helper.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


def las(rows, curves='DEPT.M : index\nGR.API : gamma ray', extra='', version='2.0', wrap='NO'):
    return f'~Version\nVERS. {version}\nWRAP. {wrap}\n~Well\nSTRT.M 100\nSTOP.M 102\nSTEP.M 1\nNULL. -999.25\nWELL. Test\n{extra}\n~Curve\n{curves}\n~ASCII\n{rows}\n'


class LasTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'fixture.las'

    def tearDown(self):
        self.temp.cleanup()

    def read(self, text, request=None):
        self.path.write_text(text)
        return helper.window(str(self.path), request or {})

    def test_null_zero_units_and_exact_rows(self):
        r = self.read(las('100 0\n101 -999.25\n102 2'), {'mode': 'rows', 'startRow': 2})
        self.assertEqual(r['rows'][0], dict(row=2, depth=101., values=[None], breakBefore=False))
        self.assertEqual(r['curves'][1]['nullCount'], 1)
        self.assertEqual(r['curves'][1]['min'], 0)
        self.assertEqual(r['curves'][1]['unit'], 'API')
        self.assertEqual(r['depth']['basis'], 'unknown')
        self.assertEqual(r['nullValue'], -999.25)

    def test_lidar_and_las3_explicitly_unsupported(self):
        self.path.write_bytes(b'LASF' + bytes(100))
        with self.assertRaisesRegex(ValueError, 'LiDAR'):
            helper.window(str(self.path), {})
        with self.assertRaisesRegex(ValueError, 'unsupported'):
            self.read(las('100 1', version='3.0'))

    def test_wrapped_logical_rows(self):
        r = self.read(las('100\n0\n101\n-999.25\n102\n2', wrap='YES'))
        self.assertEqual(r['sourceRows'], 3)
        self.assertEqual([s['values'] for s in r['rows']], [[0.], [None], [2.]])

    def test_depth_breaks_and_unknown_units(self):
        r = self.read(las('100 1\n101 2\n101 3\n-999.25 4\n105 5\n106 6\n110 7\n109 8', curves='DEPT.FURLONG : index\nGR. : value'))
        codes = {i['code'] for i in r['issues']}
        self.assertTrue({'depth-duplicate', 'depth-missing', 'depth-gap', 'depth-reversal', 'depth-unit-unknown', 'curve-unit-unknown'} <= codes)
        self.assertTrue(r['rows'][2]['breakBefore'])
        self.assertTrue(r['rows'][4]['breakBefore'])
        self.assertEqual(r['rows'][3]['depth'], None)
        self.assertEqual(r['depth']['direction'], 'mixed')

    def test_downward_run_is_not_a_reversal(self):
        r = self.read(las('102 1\n101 2\n100 3').replace('STEP.M 1', 'STEP.M -1'))
        self.assertEqual(r['depth']['direction'], 'decreasing')
        self.assertNotIn('depth-reversal', [i['code'] for i in r['issues']])

    def test_duplicate_curve_names_and_explicit_basis(self):
        r = self.read(las('100 1 2\n101 2 3\n102 3 4', curves='DEPT.M : index\nGR.API : A\nGR.API : B', extra='BASIS. TVD\nDATUM. RKB'))
        self.assertEqual(r['depth']['basis'], 'TVD')
        self.assertEqual(r['depth']['datum'], 'RKB')
        self.assertNotEqual(r['curves'][1]['mnemonic'], r['curves'][2]['mnemonic'])
        self.assertEqual(r['curves'][1]['originalMnemonic'], 'GR')

    def test_spike_gap_preserving_reduction_and_cap(self):
        rows = '\n'.join(f'{100+i} {999 if i == 4567 else -999.25 if 6000 <= i <= 6002 else i % 11}' for i in range(10000))
        r = self.read(las(rows), {'limit': 80})
        self.assertLessEqual(len(r['rows']), 80)
        self.assertTrue(r['sampled'])
        self.assertFalse(r['truncated'])
        by_row = {s['row']: s for s in r['rows']}
        self.assertEqual(by_row[4568]['values'][0], 999)
        self.assertIsNone(by_row[6001]['values'][0])
        self.assertIn(6004, by_row)
        self.assertEqual(r['sourceRows'], 10000)
        alternating = '\n'.join(f'{100+i} {-999.25 if i % 2 else i}' for i in range(100))
        r = self.read(las(alternating), {'limit': 10})
        self.assertTrue(r['truncated'])
        self.assertEqual([s['row'] for s in r['rows']], list(range(1, 11)))
        self.assertEqual(r['nextRow'], 11)

    def test_multi_mb_las_is_numerical_not_raw_text(self):
        rows = '\n'.join(f'{100+i} {i}.12345678901234567890 {i}.12345678901234567890' for i in range(50000))
        r = self.read(las(rows, curves='DEPT.M : index\nGR.API : GR\nRHOB.g/cm3 : density'), {'limit': 100})
        self.assertGreater(self.path.stat().st_size, 2 * 1024 * 1024)
        self.assertEqual(r['sourceRows'], 50000)
        self.assertLessEqual(r['displayedRows'], 100)
        r = helper.window(str(self.path), {'mode': 'rows', 'startRow': 49999, 'limit': 2})
        self.assertEqual(r['rows'][1]['row'], 50000)
        self.assertEqual(r['rows'][1]['depth'], 50099)

if __name__ == '__main__':
    unittest.main()
