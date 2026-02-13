import express, { type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import {
  appendPhotoEventRecord,
  createSessionRecord,
  getAllSessions,
  getMeetupById,
  getPhotoEventsForSession,
  getSessionById,
  upsertMeetup,
} from './lib/jsonDb.js';
import { users, MOCK_MEETUP_ID } from './mock/users.js';
import { getPhotosForAlbum, MOCK_ALBUM_ID } from './mock/photos.js';
import type { Meetup, PhotoEventRequestBody, HmsRoomResponse, HmsTokenPayload } from './types.js';

// Resolve __dirname in ESM so we can load server/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root .env (if present) and then server/.env (overrides)
dotenv.config();
dotenv.config({ path: path.join(__dirname, '.env'), override: true });

const app = express();
const PORT = process.env.PORT || 4000;
const HMS_API_BASE_URL = process.env.HMS_API_BASE_URL || 'https://api.100ms.live';
const HMS_TEMPLATE_ID = process.env.HMS_TEMPLATE_ID;
const HMS_MANAGEMENT_TOKEN = process.env.HMS_MANAGEMENT_TOKEN;
const HMS_ROOM_ID = process.env.HMS_ROOM_ID;

app.use(cors());
app.use(express.json());

// Simple request logger
app.use((req: Request, res: Response, next) => {
  const start = Date.now();
  const { method, originalUrl } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;

    console.log(
      JSON.stringify({
        level: 'info',
        ts: new Date().toISOString(),
        method,
        path: originalUrl,
        status: res.statusCode,
        durationMs: duration,
      }),
    );
  });

  next();
});

// ---------------------------------------------------------------------------
// In-memory demo data – replace with real persistence later.
// ---------------------------------------------------------------------------

function getOrCreateMeetup(meetupId: string): Meetup {
  const existing = getMeetupById(meetupId);
  if (existing) {
    return existing;
  }

  const id = meetupId || MOCK_MEETUP_ID;
  const meetup: Meetup = {
    id,
    title: 'Memories with Nanny',
    albumId: MOCK_ALBUM_ID,
    albumName: 'Sanibel Island Trip (1987)',
    recordedAt: '2023-08-25T14:30:00Z',
    durationSeconds: 47 * 60,
    photoCount: 12,
    videoRoomId: process.env.HMS_ROOM_ID || null,
  };

  upsertMeetup(meetup);
  return meetup;
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generate100msToken(userId: string, roomId: string, role: string): string {
  const accessKey = process.env.HMS_ACCESS_KEY;
  const appSecret = process.env.HMS_APP_SECRET;

  if (!accessKey || !appSecret) {
    throw new Error('Missing HMS_ACCESS_KEY or HMS_APP_SECRET – cannot generate 100ms token');
  }

  const payload: HmsTokenPayload = {
    access_key: accessKey,
    room_id: roomId,
    user_id: userId,
    role,
    type: 'app',
    version: 2,
    iat: Math.floor(Date.now() / 1000),
    nbf: Math.floor(Date.now() / 1000),
  };

  return jwt.sign(payload, appSecret, {
    algorithm: 'HS256',
    expiresIn: '24h',
    jwtid: uuidv4(),
  });
}

// ---------------------------------------------------------------------------
// 100ms room creation – called when a meetup is scheduled
// ---------------------------------------------------------------------------

async function ensureHmsRoomForMeetup(meetup: Meetup): Promise<string> {
  // If a room is already associated, just reuse it.
  if (meetup.videoRoomId) {
    return meetup.videoRoomId;
  }

  // If management configuration is missing, fail fast instead of using a fake room ID.
  if (!HMS_TEMPLATE_ID || !HMS_MANAGEMENT_TOKEN) {
    throw new Error(
      'Missing HMS_TEMPLATE_ID or HMS_MANAGEMENT_TOKEN - cannot ensure 100ms room for meetup',
    );
  }

  const url = `${HMS_API_BASE_URL}/v2/rooms`;

  const body = {
    name: `meetup-${meetup.id}`,
    template_id: HMS_TEMPLATE_ID,
    recording_info: {
      enabled: true,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${HMS_MANAGEMENT_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');

    console.error(
      JSON.stringify({
        level: 'error',
        ts: new Date().toISOString(),
        msg: 'Failed to create 100ms room',
        status: response.status,
        body: errorText,
      }),
    );
    throw new Error('Failed to create 100ms room');
  }

  const data = (await response.json()) as HmsRoomResponse;

  // 100ms returns "id" as the room identifier.
  const roomId = data.id || data.room_id;

  if (!roomId) {
    throw new Error('100ms room response did not include an id');
  }

  meetup.videoRoomId = roomId;
  return roomId;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

function getCurrentUser(req: Request) {
  // Get userId from query parameter
  const userId = (req.query.userId as string) || (req.query.user_id as string);
  if (!userId) {
    return null;
  }
  return users.get(userId) || null;
}

function getUserRoleForMeetup(user: ReturnType<typeof getCurrentUser>, meetupId: string) {
  if (!user || !user.rolesByMeetup) {
    return null;
  }
  return user.rolesByMeetup[meetupId] || null;
}

// ---------------------------------------------------------------------------

app.get('/meetups/:id', (req: Request, res: Response) => {
  const meetupId = req.params.id as string;
  const meetup = getOrCreateMeetup(meetupId);
  res.json(meetup);
});

// Meetup scheduling – create a 100ms room using a template
app.post('/meetups/:id/schedule', async (req: Request, res: Response) => {
  const meetupId = req.params.id as string;
  const meetup = getOrCreateMeetup(meetupId);

  try {
    const videoRoomId = await ensureHmsRoomForMeetup(meetup);

    res.json({
      meetup_id: meetup.id,
      video_room_id: videoRoomId,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to schedule meetup and create room';
    res.status(500).json({
      error: errorMessage,
    });
  }
});

// Auth token – verify user & invite, then generate 100ms access token
app.get('/meetups/:id/auth-token', async (req: Request, res: Response) => {
  const meetupId = req.params.id as string;
  getOrCreateMeetup(meetupId);

  const user = getCurrentUser(req);
  if (!user) {
    return res
      .status(401)
      .json({ error: 'User not authenticated. Please provide userId query parameter.' });
  }

  const role = getUserRoleForMeetup(user, meetupId);

  if (!role) {
    // User is logged in but not invited / assigned a role for this meetup.
    return res.status(403).json({ error: 'User is not invited to this meetup' });
  }

  if (!HMS_ROOM_ID) {
    return res.status(500).json({ error: 'HMS_ROOM_ID is not configured on the server' });
  }

  try {
    const token = generate100msToken(user.id, HMS_ROOM_ID, role);

    res.json({
      token,
      userName: user.name,
      userId: user.id,
      userType: user.type,
      role,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate 100ms token';
    return res.status(500).json({ error: errorMessage });
  }
});

app.get('/albums/:id/photos', (req: Request, res: Response) => {
  const albumId = (req.params.id as string) || MOCK_ALBUM_ID;
  res.json(getPhotosForAlbum(albumId));
});

app.post('/meetups/:id/session', (req: Request, res: Response) => {
  const meetupId = req.params.id as string;
  const sessionId = uuidv4();
  const recordingStartTimestampMs = Date.now();

  const session = {
    meetupId,
    sessionId,
    recordingStartTimestampMs,
  };

  createSessionRecord(session);

  res.json({
    sessionId,
    recordingStartTimestampMs,
  });
});

app.post('/meetups/:id/photo-events', (req: Request, res: Response) => {
  const meetupId = req.params.id as string;
  const { session_id, photo_id, photo_index, timestamp_ms, navigator_user_id } =
    req.body as PhotoEventRequestBody;

  const sessionId = session_id;

  const session = sessionId ? getSessionById(sessionId) : null;
  if (!session) {
    return res.status(400).json({ error: 'Unknown session_id' });
  }

  const event = {
    meetupId,
    sessionId,
    photoId: photo_id,
    photoIndex: photo_index,
    timestampMs: timestamp_ms,
    navigatorUserId: navigator_user_id,
    receivedAt: Date.now(),
  };

  appendPhotoEventRecord(sessionId, event);

  console.log(
    JSON.stringify({
      level: 'info',
      ts: new Date().toISOString(),
      type: 'photo-event',
      event,
    }),
  );

  res.status(204).end();
});

app.get('/meetups/:id/session/current', (req: Request, res: Response) => {
  const meetupId = req.params.id as string;

  // Find the most recent session for this meetup.
  const [latestSession] = getAllSessions()
    .filter((session) => session.meetupId === meetupId)
    .sort((a, b) => b.recordingStartTimestampMs - a.recordingStartTimestampMs);

  if (!latestSession) {
    return res.status(404).json({ error: 'No active session' });
  }

  const events = getPhotoEventsForSession(latestSession.sessionId) || [];

  if (!events.length) {
    return res.json({ currentPhotoIndex: 0 });
  }

  const lastEvent = events[events.length - 1];
  res.json({ currentPhotoIndex: lastEvent.photoIndex ?? 0 });
});

app.get('/meetups/:id/summary', (req: Request, res: Response) => {
  const meetupId = req.params.id as string;
  const meetup = getOrCreateMeetup(meetupId);

  res.json({
    meetup_id: meetup.id,
    title: meetup.title,
    recorded_at: meetup.recordedAt,
    duration_seconds: meetup.durationSeconds,
    participants: ['Bill', 'Dena', 'Susan'],
    photo_count: meetup.photoCount,
    summary: {
      short_summary:
        'The family gathered to reminisce about photos featuring Nanny, with particular focus on a 1987 Sanibel Island vacation.',
      key_points: [
        "The family vacation to Sanibel Island was after Dad's birthday.",
        "Mom's crab cakes were a family favorite.",
        "Uncle Joe's appetite was a running family joke.",
      ],
      action_items: [
        'Susan to find more photos from the Sanibel trip.',
        'Bill to ask Aunt Mary for the crab cake recipe.',
      ],
    },
  });
});

app.get('/photos/:id/meetup-clips', (req: Request, res: Response) => {
  const photoId = req.params.id as string;
  const meetup = getOrCreateMeetup(MOCK_MEETUP_ID);

  res.json({
    photo_id: photoId,
    clips: [
      {
        meetup_id: meetup.id,
        meetup_title: meetup.title,
        clip_url: 'https://cdn.demo.com/clips/demo-clip.mp4',
        thumbnail_url: 'https://cdn.demo.com/thumbs/demo-thumb.jpg',
        duration_seconds: 45,
        transcript: {
          sentences: [
            {
              speaker: 'Bill',
              text: "You know, I remember this day. We went to Sanibel Island right after Dad's birthday.",
            },
            {
              speaker: 'Dena',
              text: "That's right! And Mom made her famous crab cakes. Remember how Uncle Joe ate like six of them?",
            },
          ],
        },
        participants: ['Bill', 'Dena', 'Susan'],
        recorded_at: meetup.recordedAt,
      },
    ],
  });
});

app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: '100ms Meetups demo API' });
});

app.listen(PORT, () => {
  console.log(
    JSON.stringify({
      level: 'info',
      ts: new Date().toISOString(),
      msg: `100ms Meetups demo API listening on http://localhost:${PORT}`,
      port: PORT,
    }),
  );
});
