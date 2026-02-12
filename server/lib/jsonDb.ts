import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Database, Meetup, Session, PhotoEvent } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE_PATH = path.join(__dirname, 'db.json');

/**
 * Very lightweight JSON "database" for the demo.
 * Data is kept in memory and flushed to disk on each write.
 */
let db: Database = {
  meetups: {},
  sessions: {},
  photoEventsBySession: {},
};

function loadDbFromDisk(): void {
  if (!fs.existsSync(DB_FILE_PATH)) {
    saveDbToDisk();
    return;
  }

  try {
    const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw) as Partial<Database>;
    db = {
      meetups: parsed.meetups || {},
      sessions: parsed.sessions || {},
      photoEventsBySession: parsed.photoEventsBySession || {},
    };
  } catch {
    // If anything goes wrong, start from a clean slate.
    db = {
      meetups: {},
      sessions: {},
      photoEventsBySession: {},
    };
  }
}

function saveDbToDisk(): void {
  const payload = JSON.stringify(db, null, 2);
  fs.writeFileSync(DB_FILE_PATH, payload, 'utf-8');
}

loadDbFromDisk();

// ---------------------------------------------------------------------------
// Meetups
// ---------------------------------------------------------------------------

export function getMeetupById(id: string): Meetup | null {
  return db.meetups[id] || null;
}

export function upsertMeetup(meetup: Meetup): void {
  if (!meetup || !meetup.id) {
    return;
  }
  db.meetups[meetup.id] = meetup;
  saveDbToDisk();
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export function createSessionRecord(session: Session): void {
  if (!session || !session.sessionId) {
    return;
  }
  db.sessions[session.sessionId] = session;
  saveDbToDisk();
}

export function getSessionById(sessionId: string): Session | null {
  return db.sessions[sessionId] || null;
}

export function getAllSessions(): Session[] {
  return Object.values(db.sessions);
}

// ---------------------------------------------------------------------------
// Photo events
// ---------------------------------------------------------------------------

export function appendPhotoEventRecord(sessionId: string, event: PhotoEvent): void {
  if (!sessionId || !event) {
    return;
  }
  if (!db.photoEventsBySession[sessionId]) {
    db.photoEventsBySession[sessionId] = [];
  }
  db.photoEventsBySession[sessionId].push(event);
  saveDbToDisk();
}

export function getPhotoEventsForSession(sessionId: string): PhotoEvent[] {
  return db.photoEventsBySession[sessionId] || [];
}
