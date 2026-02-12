import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE_PATH = path.join(__dirname, 'db.json');

/**
 * Very lightweight JSON "database" for the demo.
 * Data is kept in memory and flushed to disk on each write.
 */
let db = {
  meetups: {},
  sessions: {},
  photoEventsBySession: {},
};

function loadDbFromDisk() {
  if (!fs.existsSync(DB_FILE_PATH)) {
    saveDbToDisk();
    return;
  }

  try {
    const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
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

function saveDbToDisk() {
  const payload = JSON.stringify(db, null, 2);
  fs.writeFileSync(DB_FILE_PATH, payload, 'utf-8');
}

loadDbFromDisk();

// ---------------------------------------------------------------------------
// Meetups
// ---------------------------------------------------------------------------

export function getMeetupById(id) {
  return db.meetups[id] || null;
}

export function upsertMeetup(meetup) {
  if (!meetup || !meetup.id) {
    return;
  }
  db.meetups[meetup.id] = meetup;
  saveDbToDisk();
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export function createSessionRecord(session) {
  if (!session || !session.sessionId) {
    return;
  }
  db.sessions[session.sessionId] = session;
  saveDbToDisk();
}

export function getSessionById(sessionId) {
  return db.sessions[sessionId] || null;
}

export function getAllSessions() {
  return Object.values(db.sessions);
}

// ---------------------------------------------------------------------------
// Photo events
// ---------------------------------------------------------------------------

export function appendPhotoEventRecord(sessionId, event) {
  if (!sessionId || !event) {
    return;
  }
  if (!db.photoEventsBySession[sessionId]) {
    db.photoEventsBySession[sessionId] = [];
  }
  db.photoEventsBySession[sessionId].push(event);
  saveDbToDisk();
}

export function getPhotoEventsForSession(sessionId) {
  return db.photoEventsBySession[sessionId] || [];
}
