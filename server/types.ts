export interface Meetup {
  id: string;
  title: string;
  albumId: string;
  albumName: string;
  recordedAt: string;
  durationSeconds: number;
  photoCount: number;
  videoRoomId: string | null;
}

export interface Session {
  meetupId: string;
  sessionId: string;
  recordingStartTimestampMs: number;
}

export interface PhotoEvent {
  meetupId: string;
  sessionId: string;
  photoId: string;
  photoIndex: number;
  timestampMs: number;
  navigatorUserId: string;
  receivedAt: number;
}

export interface Database {
  meetups: Record<string, Meetup>;
  sessions: Record<string, Session>;
  photoEventsBySession: Record<string, PhotoEvent[]>;
}

export interface User {
  id: string;
  name: string;
  email: string;
  type: 'host' | 'guest';
  rolesByMeetup: Record<string, string>;
}

export interface Photo {
  id: string;
  albumId: string;
  url: string;
  thumbnailUrl: string;
  title: string;
  index: number;
}

export interface PhotoEventRequestBody {
  session_id: string;
  photo_id: string;
  photo_index: number;
  timestamp_ms: number;
  navigator_user_id: string;
}

export interface HmsRoomResponse {
  id?: string;
  room_id?: string;
}

export interface HmsTokenPayload {
  access_key: string;
  room_id: string;
  user_id: string;
  role: string;
  type: string;
  version: number;
  iat: number;
  nbf: number;
}
