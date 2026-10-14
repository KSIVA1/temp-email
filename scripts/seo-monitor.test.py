"""Offline checks preventing missing DNS evidence from becoming false outage claims."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch, MagicMock
from datetime import date

spec = importlib.util.spec_from_file_location('seo_monitor', Path(__file__).with_name('seo-monitor.py'))
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)

def answers(hosts):
    return {'Status':0, 'Answer':[{'type':15, 'data':f'10 {host}.', 'TTL':300} for host in hosts]}

class ReceivingDnsTests(unittest.TestCase):
    def test_expected_cloudflare_records(self):
        result = monitor.classify_mx('veqla.com', answers(monitor.EXPECTED_MX))
        self.assertEqual(result['status'], 'ok')
        self.assertEqual(len(result['mx']), 3)

    def test_wrong_provider_is_a_configuration_issue(self):
        result = monitor.classify_mx('veqla.com', answers(['mx.example.com']))
        self.assertEqual(result['status'], 'issues')
        self.assertIn('MX hosts differ', result['issues'][0])

    def test_reduced_redundancy_is_not_labelled_total_outage(self):
        result = monitor.classify_mx('veqla.com', answers(['route1.mx.cloudflare.net']))
        self.assertEqual(result['issues'], ['Configured MX redundancy is incomplete'])

    def test_null_mx_declares_no_email_service(self):
        result = monitor.classify_mx('veqla.com', {'Status':0, 'Answer':[{'type':15,'data':'0 .'}]})
        self.assertIn('null MX', result['issues'][0])

    def test_nodata_and_nxdomain_are_distinct(self):
        for response, message in [({'Status':0},'no MX records'),({'Status':3},'NXDOMAIN')]:
            with self.subTest(response=response):
                result = monitor.classify_mx('veqla.com', response)
                self.assertEqual(result['status'], 'issues')
                self.assertIn(message, result['issues'][0])

    def test_resolver_errors_or_unverifiable_payloads_are_gaps(self):
        for response in [{'Status':2}, {}, [], {'Status':False}, {'Status':0,'TC':True},
                         {'Status':0,'Answer':{}}, {'Status':0,'Answer':[None]},
                         {'Status':0,'Answer':[{'type':15,'data':'bad'}]}]:
            with self.subTest(response=response):
                result = monitor.classify_mx('veqla.com', response)
                self.assertEqual(result['status'], 'unavailable')
                self.assertEqual(result['issues'], [])

    def test_timeout_is_a_measurement_gap(self):
        with patch.object(monitor, 'urlopen', side_effect=TimeoutError):
            result = monitor.inspect_receiving_dns('veqla.com')
        self.assertEqual(result['status'], 'unavailable')
        self.assertEqual(result['error'], 'TimeoutError')

    def test_invalid_names_never_start_network_requests(self):
        with patch.object(monitor, 'urlopen') as request:
            for name in ['https://example.com/', 'veqla.com?type=A', '-bad.example', 'bad..example', None]:
                self.assertEqual(monitor.inspect_receiving_dns(name)['status'], 'unavailable')
            request.assert_not_called()

class SearchConsoleWindowTests(unittest.TestCase):
    def test_complete_calendar_windows_are_paired_and_keep_query_page_exports(self):
        svc = MagicMock()
        svc.urlInspection.return_value.index.return_value.inspect.return_value.execute.return_value = {}
        with patch.object(monitor, 'analytics', return_value=[]):
            result = monitor.collect_gsc(svc, date(2026, 10, 13))
        periods = result['periods']
        self.assertEqual((periods['7d']['start'], periods['7d']['end']), ('2026-10-04', '2026-10-10'))
        self.assertEqual((periods['previous7d']['start'], periods['previous7d']['end']), ('2026-09-27', '2026-10-03'))
        self.assertEqual((periods['28d']['start'], periods['28d']['end']), ('2026-09-13', '2026-10-10'))
        self.assertEqual((periods['previous28d']['start'], periods['previous28d']['end']), ('2026-08-16', '2026-09-12'))
        self.assertTrue(all(p['queries'] == [] and p['pages'] == [] for p in periods.values()))

    def test_api_uses_google_country_code_and_final_data_separately_from_dashboard_locale(self):
        svc = MagicMock()
        svc.searchanalytics.return_value.query.return_value.execute.return_value = {}
        monitor.analytics(svc, date(2026, 10, 4), date(2026, 10, 10), ['query'])
        body = svc.searchanalytics.return_value.query.call_args.kwargs['body']
        self.assertEqual(body['dataState'], 'final')
        self.assertEqual(body['dimensionFilterGroups'][0]['filters'][0]['expression'], 'usa')
        self.assertEqual(body['dimensionFilterGroups'][0]['filters'][1]['expression'], 'DESKTOP')

if __name__ == '__main__': unittest.main()
