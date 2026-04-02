/**
 * db.js — SQLite 연결 + 스키마 초기화
 * Node.js v22+ 내장 node:sqlite 사용 (별도 설치 불필요)
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = path.join(__dirname, 'campaigns.db');

let _db = null;

function getDb() {
  if (_db) return _db;

  _db = new DatabaseSync(DB_PATH);

  _db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT    NOT NULL,
      link       TEXT    NOT NULL UNIQUE,
      image      TEXT    DEFAULT '',
      region     TEXT    DEFAULT '',
      deadline   TEXT    DEFAULT '',
      source     TEXT    NOT NULL,
      created_at TEXT    NOT NULL,
      updated_at TEXT    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_source   ON campaigns(source);
    CREATE INDEX IF NOT EXISTS idx_deadline ON campaigns(deadline);
  `);

  return _db;
}

function upsertCampaigns(campaigns) {
  const db = getDb();
  const now = new Date().toISOString();

  const upsert = db.prepare(`
    INSERT INTO campaigns (title, link, image, region, deadline, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(link) DO UPDATE SET
      title      = excluded.title,
      image      = excluded.image,
      region     = excluded.region,
      deadline   = excluded.deadline,
      updated_at = excluded.updated_at
  `);

  const checkStmt = db.prepare('SELECT id FROM campaigns WHERE link = ?');

  let inserted = 0, updated = 0;
  for (const c of campaigns) {
    const exists = checkStmt.get(c.link);
    upsert.run(c.title, c.link, c.image || '', c.region || '', c.deadline || '', c.source, now, now);
    exists ? updated++ : inserted++;
  }

  return { inserted, updated };
}

function getCampaigns({ source, region, q, limit = 200, offset = 0 } = {}) {
  const db = getDb();
  const conditions = [];
  const params = [];

  if (source) {
    conditions.push('source = ?');
    params.push(source);
  }
  if (region) {
    conditions.push('region LIKE ?');
    params.push(`%${region}%`);
  }
  if (q) {
    conditions.push('(title LIKE ? OR region LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT id, title, link, image, region, deadline, source, created_at, updated_at
    FROM campaigns
    ${where}
    ORDER BY
      CASE WHEN deadline = '' THEN 1 ELSE 0 END,
      deadline ASC,
      id DESC
    LIMIT ? OFFSET ?
  `;
  params.push(limit, offset);

  return db.prepare(sql).all(...params);
}

function getStats() {
  const db = getDb();
  return {
    total   : db.prepare('SELECT COUNT(*) as n FROM campaigns').get().n,
    sources : db.prepare('SELECT source, COUNT(*) as n FROM campaigns GROUP BY source').all(),
  };
}

module.exports = { getDb, upsertCampaigns, getCampaigns, getStats };
