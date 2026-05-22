type Row = Record<string, any>;

class FakePreparedStatement {
  constructor(
    private db: FakeD1Database,
    private sql: string,
    private values: unknown[] = [],
  ) {}

  bind(...values: unknown[]) {
    return new FakePreparedStatement(this.db, this.sql, values);
  }

  async run() {
    this.db.executePrepared(this.sql, this.values);
    return { success: true };
  }

  async first<T = Row>() {
    return this.db.queryPrepared(this.sql, this.values)[0] as T | null;
  }

  async all<T = Row>() {
    return { results: this.db.queryPrepared(this.sql, this.values) as T[] };
  }
}

class FakeD1Database {
  private tables: Record<string, Row[]> = {
    inboxes: [],
    messages: [],
    domains: [],
    rate_limits: [],
  };

  prepare(sql: string) {
    return new FakePreparedStatement(this, sql);
  }

  async exec(sql: string) {
    for (const statement of sql.split(';').map((part) => part.trim()).filter(Boolean)) {
      this.executeRaw(statement);
    }
    return { count: 1, duration: 0 };
  }

  table(name: string) {
    return this.tables[name];
  }

  executePrepared(sql: string, values: unknown[]) {
    const normalized = normalize(sql);
    if (normalized.startsWith('insert into inboxes')) {
      this.tables.inboxes.push(row(['id', 'local_part', 'domain', 'created_at', 'expires_at'], values));
      return;
    }
    if (normalized.startsWith('insert into messages')) {
      this.tables.messages.push(row(['id', 'inbox_id', 'from_name', 'from_email', 'subject', 'body_html', 'preview', 'otp', 'received_at', 'expires_at'], values));
      return;
    }
    if (normalized.startsWith('update inboxes set expires_at')) {
      this.tables.inboxes.filter((r) => r.id === values[1]).forEach((r) => { r.expires_at = values[0]; });
      return;
    }
    if (normalized.startsWith('update messages set expires_at')) {
      this.tables.messages.filter((r) => r.inbox_id === values[1]).forEach((r) => { r.expires_at = values[0]; });
      return;
    }
    if (normalized.startsWith('update domains set last_inbound_at')) {
      this.tables.domains.filter((r) => r.name === values[1]).forEach((r) => { r.last_inbound_at = values[0]; });
      return;
    }
    if (normalized.startsWith('insert or replace into rate_limits')) {
      this.tables.rate_limits = this.tables.rate_limits.filter((r) => r.key !== values[0]);
      this.tables.rate_limits.push(row(['key', 'window_start', 'count'], values));
      return;
    }
    if (normalized.startsWith('update rate_limits set count')) {
      this.tables.rate_limits.filter((r) => r.key === values[1]).forEach((r) => { r.count = values[0]; });
      return;
    }
    if (normalized.startsWith('delete from messages where inbox_id = ? and id = ?')) {
      this.tables.messages = this.tables.messages.filter((r) => !(r.inbox_id === values[0] && r.id === values[1]));
      return;
    }
    if (normalized.startsWith('delete from messages where inbox_id = ?')) {
      this.tables.messages = this.tables.messages.filter((r) => r.inbox_id !== values[0]);
      return;
    }
    if (normalized.startsWith('delete from inboxes where id = ?')) {
      this.tables.inboxes = this.tables.inboxes.filter((r) => r.id !== values[0]);
      return;
    }
    if (normalized.startsWith('delete from messages where expires_at < ?')) {
      this.tables.messages = this.tables.messages.filter((r) => Number(r.expires_at) >= Number(values[0]));
      return;
    }
    if (normalized.startsWith('delete from inboxes where expires_at < ?')) {
      this.tables.inboxes = this.tables.inboxes.filter((r) => Number(r.expires_at) >= Number(values[0]));
      return;
    }
    throw new Error(`Unsupported prepared SQL: ${sql}`);
  }

  queryPrepared(sql: string, values: unknown[]): Row[] {
    const normalized = normalize(sql);
    if (normalized === 'select 1') return [{ '1': 1 }];
    if (normalized.startsWith('select key, window_start, count from rate_limits where key = ?')) {
      return this.tables.rate_limits.filter((r) => r.key === values[0]);
    }
    if (normalized.includes("from domains where status = 'active' order by name")) {
      return this.tables.domains.filter((r) => r.status === 'active').sort((a, b) => a.name.localeCompare(b.name));
    }
    if (normalized.includes("from domains where status = 'active'")) {
      return this.tables.domains.filter((r) => r.status === 'active');
    }
    if (normalized === 'select * from domains order by name') {
      return this.tables.domains.sort((a, b) => a.name.localeCompare(b.name));
    }
    if (normalized.startsWith('select count(*) as count from messages where received_at > ?')) {
      const inboxIds = this.tables.inboxes.filter((r) => r.domain === values[1]).map((r) => r.id);
      return [{ count: this.tables.messages.filter((r) => Number(r.received_at) > Number(values[0]) && inboxIds.includes(r.inbox_id)).length }];
    }
    if (normalized.startsWith('select * from inboxes where id = ? and expires_at > ?')) {
      return this.tables.inboxes.filter((r) => r.id === values[0] && Number(r.expires_at) > Number(values[1]));
    }
    if (normalized.startsWith('select * from inboxes where id = ?')) {
      return this.tables.inboxes.filter((r) => r.id === values[0]);
    }
    if (normalized.startsWith('select * from inboxes where lower(local_part)')) {
      return this.tables.inboxes.filter((r) => String(r.local_part).toLowerCase() === values[0] && String(r.domain).toLowerCase() === values[1] && Number(r.expires_at) > Number(values[2]));
    }
    if (normalized.includes('from messages where inbox_id = ? and received_at > ?')) {
      return this.tables.messages
        .filter((r) => r.inbox_id === values[0] && Number(r.received_at) > Number(values[1]))
        .sort((a, b) => Number(b.received_at) - Number(a.received_at));
    }
    throw new Error(`Unsupported query SQL: ${sql}`);
  }

  private executeRaw(sql: string) {
    const match = sql.match(/^INSERT INTO (\w+) \(([^)]+)\) VALUES \((.+)\)$/i);
    if (!match) throw new Error(`Unsupported raw SQL: ${sql}`);
    const [, table, fieldsRaw, valuesRaw] = match;
    const fields = fieldsRaw.split(',').map((field) => field.trim());
    const values = parseValues(valuesRaw);
    this.tables[table].push(row(fields, values));
  }
}

export function createTestEnv() {
  return {
    DB: new FakeD1Database() as unknown as D1Database & FakeD1Database,
    CORS_ORIGIN: 'https://inboxfornow.com',
    DEV_SKIP_TURNSTILE: '1',
  };
}

export function incomingEmail(input: { to: string; from: string; raw: string }) {
  return {
    to: input.to,
    from: input.from,
    raw: input.raw,
    rejection: null as string | null,
    setReject(reason: string) {
      this.rejection = reason;
    },
  } as ForwardableEmailMessage & { raw: string; rejection: string | null };
}

function normalize(sql: string) {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function row(fields: string[], values: unknown[]) {
  return Object.fromEntries(fields.map((field, index) => [field, values[index]]));
}

function parseValues(raw: string): unknown[] {
  const values: unknown[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    if (char === "'") {
      quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) {
      values.push(coerce(current.trim()));
      current = '';
      continue;
    }
    current += char;
  }
  values.push(coerce(current.trim()));
  return values;
}

function coerce(value: string): unknown {
  if (/^null$/i.test(value)) return null;
  if (/^-?\d+$/.test(value)) return Number(value);
  return value;
}
