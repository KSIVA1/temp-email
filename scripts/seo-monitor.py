#!/usr/bin/env python3
"""Read-only crawl and Search Console snapshots; explicit --authorize restores OAuth."""
from __future__ import annotations
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import sys
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from urllib.parse import urlencode, urljoin, urlparse
from urllib.robotparser import RobotFileParser
from xml.etree import ElementTree
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
CONFIG = json.loads((ROOT / 'docs/seo-targets.json').read_text())
SITE = f"https://{CONFIG['domain']}/"
PROPERTY = f"sc-domain:{CONFIG['domain']}"
SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly']
SECRETS = Path.home() / '.claude/skills/seo/.secrets'
TOKEN = Path(os.environ.get('GSC_TOKEN_PATH', SECRETS / 'gsc-token.json')).expanduser()
CLIENT = Path(os.environ.get('GSC_CLIENT_PATH', SECRETS / 'credentials.json')).expanduser()
INFRA = json.loads((ROOT / 'infra/config.json').read_text())
EXPECTED_MX = {host.lower().rstrip('.') for host in INFRA['expectedMxHosts']}
DNS_RESOLVER = 'https://cloudflare-dns.com/dns-query'

class Head(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonicals, self.robots, self.h1_count, self.resources = [], [], 0, []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'link' and a.get('rel') == 'canonical': self.canonicals.append(a.get('href'))
        if tag == 'meta' and a.get('name', '').lower() == 'robots': self.robots.append(a.get('content', ''))
        if tag == 'h1': self.h1_count += 1
        resource = a.get('href') if tag == 'link' and a.get('rel') in ('stylesheet', 'preload') else a.get('src') if tag == 'script' else None
        if tag == 'a' and 'download' in a: resource = a.get('href')
        if resource and resource.startswith('/') and not resource.startswith('//'): self.resources.append(resource)

def get(url):
    try:
        with urlopen(Request(url, headers={'User-Agent': 'InboxForNow-SEO-Monitor/1.0'}), timeout=20) as r:
            return r.status, dict(r.headers), r.read().decode('utf-8'), r.url
    except HTTPError as e:
        return e.code, dict(e.headers), e.read().decode('utf-8', 'replace'), e.url

def inspect_page(url):
    try:
        status, headers, html, final_url = get(url)
        head = Head(); head.feed(html)
        issues = []
        if status != 200: issues.append(f'HTTP {status}')
        if final_url != url: issues.append('Sitemap URL redirects')
        if head.canonicals != [url]: issues.append('Canonical mismatch')
        if any('noindex' in x.lower() for x in head.robots) or 'noindex' in next((v for k,v in headers.items() if k.lower() == 'x-robots-tag'), '').lower(): issues.append('Indexable page has noindex')
        if head.h1_count != 1: issues.append('Expected one H1')
        return {'url': url, 'status': status, 'canonical': head.canonicals, 'issues': issues, 'resources':head.resources}
    except Exception as e:
        return {'url': url, 'status': None, 'issues': [f'Fetch failed: {type(e).__name__}']}

def crawl():
    status, _, xml, _ = get(SITE + 'sitemap.xml')
    if status != 200: raise RuntimeError('Sitemap unavailable')
    urls = [node.text for node in ElementTree.fromstring(xml).findall('{*}url/{*}loc')]
    # Do not follow arbitrary URLs supplied by a compromised sitemap.
    if not urls or any(not u.startswith(SITE) or '?' in u or '#' in u for u in urls): raise RuntimeError('Invalid sitemap URLs')
    if len(urls) != len(set(urls)): raise RuntimeError('Duplicate sitemap URLs')
    with ThreadPoolExecutor(max_workers=4) as pool: pages = list(pool.map(inspect_page, urls))
    robots_status, _, robots_text, _ = get(SITE + 'robots.txt')
    robots = RobotFileParser(); robots.parse(robots_text.splitlines())
    robots_issues = []
    if robots_status != 200: robots_issues.append(f'Robots HTTP {robots_status}')
    elif any(not robots.can_fetch('Googlebot', u) for u in urls): robots_issues.append('Googlebot blocked from sitemap page')
    resources = sorted({urljoin(SITE, r) for page in pages for r in page.pop('resources', [])})
    with ThreadPoolExecutor(max_workers=4) as pool: assets = list(pool.map(inspect_resource, resources))
    status, _, _, _ = get(SITE + 'seo-monitor-nonexistent-7e429/')
    if status != 404: pages.append({'url': SITE + 'seo-monitor-nonexistent-7e429/', 'status':status, 'issues':['Missing page must return 404']})
    return {'status':'ok' if all(not p['issues'] for p in pages) and not robots_issues and all(not a['issues'] for a in assets) else 'issues',
            'sitemap_urls':len(urls), 'pages':pages, 'robots':{'status':robots_status,'issues':robots_issues}, 'assets':assets}

def inspect_resource(url):
    if urlparse(url).netloc != CONFIG['domain']: return {'url':url,'issues':['Unexpected asset host']}
    try:
        with urlopen(Request(url,headers={'User-Agent':'InboxForNow-SEO-Monitor/1.0'}),timeout=20) as r:
            return {'url':url,'status':r.status,'bytes':len(r.read()),'content_type':r.headers.get('Content-Type'),
                    'issues':[] if r.status == 200 else [f'Asset HTTP {r.status}']}
    except Exception as e: return {'url':url,'status':None,'issues':[f'Asset unavailable: {type(e).__name__}']}

def classify_mx(domain, response):
    result = {'domain':domain, 'status':'unavailable', 'mx':[], 'issues':[]}
    code = response.get('Status') if isinstance(response, dict) else None
    result['dns_status'] = code
    if type(code) is not int or response.get('TC') is True:
        result['error'] = 'Unverifiable DNS response'; return result
    if code == 3:
        result.update(status='issues', issues=['Receiving domain does not exist (NXDOMAIN)']); return result
    if code != 0:
        result['error'] = f'DNS resolver returned code {code}'; return result
    answers = response.get('Answer', [])
    if not isinstance(answers, list) or any(not isinstance(a, dict) for a in answers):
        result['error'] = 'Malformed DNS answers'; return result
    for answer in answers:
        if answer.get('type') != 15: continue
        parts = str(answer.get('data', '')).split()
        if len(parts) != 2 or not parts[0].isdigit() or not 0 <= int(parts[0]) <= 65535:
            result['error'] = 'Malformed MX answer'; return result
        result['mx'].append({'priority':int(parts[0]), 'host':parts[1].lower().rstrip('.'), 'ttl':answer.get('TTL')})
    hosts = {record['host'] for record in result['mx']}
    if not hosts: result['issues'].append('Receiving domain has no MX records')
    elif '' in hosts: result['issues'].append('Receiving domain advertises a null MX (no email service)')
    else:
        if hosts - EXPECTED_MX: result['issues'].append('MX hosts differ from configured Email Routing provider')
        if EXPECTED_MX - hosts: result['issues'].append('Configured MX redundancy is incomplete')
    result['status'] = 'issues' if result['issues'] else 'ok'
    return result

def inspect_receiving_dns(domain):
    # The API supplies names only; all requests go to this fixed public resolver.
    if not isinstance(domain, str) or len(domain) > 253 or '.' not in domain or any(
        not re.fullmatch(r'[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?', label) for label in domain.split('.')
    ): return {'domain':domain, 'status':'unavailable', 'error':'Invalid active domain name'}
    url = DNS_RESOLVER + '?' + urlencode({'name':domain, 'type':'MX'})
    try:
        with urlopen(Request(url, headers={'Accept':'application/dns-json', 'User-Agent':'InboxForNow-SEO-Monitor/1.0'}),timeout=15) as response:
            if response.status != 200: raise RuntimeError('DNS resolver HTTP error')
            result = classify_mx(domain, json.loads(response.read()))
            return {**result, 'resolver':url}
    except Exception as e:
        return {'domain':domain, 'status':'unavailable', 'resolver':url, 'error':type(e).__name__}

def collect_service_health():
    results = []
    domains = []
    for path in ('/api/health', '/api/domains/active'):
        url = 'https://api.' + CONFIG['domain'] + path
        try:
            status, _, body, _ = get(url)
            data = json.loads(body)
            healthy = status == 200 and (data.get('ok') is True if path.endswith('health') else bool(data.get('domains')))
            if path.endswith('active') and healthy: domains = data.get('domains')
            results.append({'url':url,'status':status,'ok':healthy})
        except Exception as e: results.append({'url':url,'ok':False,'error':type(e).__name__})
    if isinstance(domains, list) and 0 < len(domains) <= 20:
        with ThreadPoolExecutor(max_workers=4) as pool: dns_checks = list(pool.map(inspect_receiving_dns, domains))
    else: dns_checks = [{'status':'unavailable','error':'No valid bounded active-domain list'}]
    state = 'issues' if not all(r['ok'] for r in results) or any(r['status'] == 'issues' for r in dns_checks) else 'unavailable' if any(r['status'] == 'unavailable' for r in dns_checks) else 'ok'
    return {'status':state,'checks':results,'receiving_dns':dns_checks,
            'note':'Read-only API and public MX configuration checks. Resolver failures are measurement gaps; missing configured redundancy is not proof of total outage. No end-to-end SMTP delivery or catch-all rule verification.'}

def save_token(creds):
    TOKEN.parent.mkdir(parents=True, exist_ok=True)
    # Private file from the first write; never print the token or commit it.
    fd = os.open(TOKEN, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as f: f.write(creds.to_json())
    TOKEN.chmod(0o600)

def service(authorize=False):
    from google.auth.transport.requests import Request as GoogleRequest
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    if authorize:
        from google_auth_oauthlib.flow import InstalledAppFlow
        if not CLIENT.exists(): raise RuntimeError('OAuth client file missing; see docs/seo-monitoring.md')
        creds = InstalledAppFlow.from_client_secrets_file(str(CLIENT), SCOPES).run_local_server(port=0, timeout_seconds=300)
        save_token(creds)
    else:
        if not TOKEN.exists(): raise RuntimeError('No saved OAuth token')
        creds = Credentials.from_authorized_user_file(str(TOKEN), SCOPES)
        if not creds.valid:
            if not creds.refresh_token: raise RuntimeError('No refresh token')
            creds.refresh(GoogleRequest()); save_token(creds)
    return build('searchconsole', 'v1', credentials=creds, cache_discovery=False)

def analytics(svc, start, end, dimensions=None, query=None):
    filters = [{'dimension':'country','operator':'equals','expression':CONFIG['country']},
               {'dimension':'device','operator':'equals','expression':CONFIG['device'].upper()}]
    if query is not None: filters.append({'dimension':'query','operator':'equals','expression':query})
    body = {'startDate':start.isoformat(), 'endDate':end.isoformat(), 'type':'web', 'dataState':'final',
            'dimensions':dimensions or [], 'dimensionFilterGroups':[{'filters':filters}], 'rowLimit':25000}
    return svc.searchanalytics().query(siteUrl=PROPERTY, body=body).execute().get('rows', [])

def collect_gsc(svc, today):
    end = today - timedelta(days=3)
    periods = {}
    for label, start, stop in [('7d',end-timedelta(days=6),end), ('28d',end-timedelta(days=27),end), ('previous28d',end-timedelta(days=55),end-timedelta(days=28))]:
        rows = analytics(svc,start,stop)
        periods[label] = {'start':start.isoformat(),'end':stop.isoformat(),'metrics':rows[0] if rows else None}
    queries = []
    for q in CONFIG['primaryQueries'] + CONFIG['secondaryQueries']:
        rows = analytics(svc,end-timedelta(days=6),end,query=q)
        queries.append({'query':q, 'metrics':rows[0] if rows else None, 'exact_organic_rank':None})
    top = analytics(svc,end-timedelta(days=27),end,['query','page'])
    inspections = []
    for url in [SITE, SITE+'use-case/discord/', SITE+'use-case/github/', SITE+'use-case/chatgpt/']:
        try:
            result = svc.urlInspection().index().inspect(body={'inspectionUrl':url,'siteUrl':PROPERTY}).execute()
            inspections.append({'url':url,'indexStatusResult':result.get('inspectionResult',{}).get('indexStatusResult',{})})
        except Exception as e: inspections.append({'url':url,'error':type(e).__name__})
    return {'status':'ok', 'market':{'country':CONFIG['country'],'device':CONFIG['device'],'search_type':'web'},
            'periods':periods, 'queries':queries, 'top_query_pages':top, 'inspections':inspections,
            'sitemaps':svc.sitemaps().list(siteUrl=PROPERTY).execute(),
            'note':'Query tables may omit anonymized searches. Average position is not a current exact organic rank. No row means unavailable data, not rank zero.'}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--authorize', action='store_true', help='Interactive browser OAuth with existing read-only scopes')
    args = parser.parse_args()
    if args.authorize:
        try:
            svc = service(True)
            properties = svc.sites().list().execute().get('siteEntry', [])
            print('Authorization restored. Target property accessible:', any(p.get('siteUrl') == PROPERTY for p in properties))
            return 0
        except Exception as e:
            print(f'Authorization failed ({type(e).__name__}); credentials were not printed.'); return 1
    now = datetime.now(ZoneInfo(CONFIG['timezone']))
    snapshot = {'observed_at':now.isoformat(),'target':CONFIG,'exact_rank_note':'Collected separately through dated browser evidence and npm run seo:rankings; this script does not measure exact ranks.'}
    try: snapshot['crawl'] = crawl()
    except Exception as e: snapshot['crawl'] = {'status':'unavailable','error':type(e).__name__}
    try: snapshot['gsc'] = collect_gsc(service(),now.date())
    except Exception as e:
        snapshot['gsc'] = {'status':'unavailable', 'error':type(e).__name__,
                           'action':'Run npm run seo:authorize to restore existing Search Console access.'}
    snapshot['services'] = collect_service_health()
    folder = ROOT / '.seo-cache/daily' / now.date().isoformat(); folder.mkdir(parents=True,exist_ok=True)
    # Preserve each observation, including same-day reruns after deployment.
    path = folder / f"snapshot-{now.strftime('%H%M%S')}.json"
    path.write_text(json.dumps(snapshot,indent=2)+'\n')
    print(json.dumps({'snapshot':str(path),'crawl':snapshot['crawl']['status'],'sitemap_urls':snapshot['crawl'].get('sitemap_urls'),
                      'gsc':snapshot['gsc']['status'],'gsc_error':snapshot['gsc'].get('error'), 'services':snapshot['services']['status'],
                      'assets':len(snapshot['crawl'].get('assets', [])), 'exact_rank':'See separately saved rankings.json and ranking-status.json'},indent=2))
    return 0 if snapshot['crawl']['status'] == 'ok' and snapshot['gsc']['status'] == 'ok' and snapshot['services']['status'] == 'ok' else 1

if __name__ == '__main__': sys.exit(main())
