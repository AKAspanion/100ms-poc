import type {
  CurrentSessionState,
  MeetupAuthTokenResponse,
  MeetupDetail,
  MeetupSummaryResponse,
  Photo,
  PhotoClipsResponse,
  SessionStartResponse,
} from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined
const isMockApi = !API_BASE_URL

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error('API_BASE_URL is not configured')
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`API ${path} failed with ${response.status}: ${text}`)
  }

  return (await response.json()) as T
}

// Public API – switches between real backend and in-memory mocks

export async function getMeetup(meetupId: string): Promise<MeetupDetail> {
  if (isMockApi) {
    return mockGetMeetup(meetupId)
  }

  return http<MeetupDetail>(`/meetups/${encodeURIComponent(meetupId)}`)
}

export async function getMeetupAuthToken(meetupId: string): Promise<MeetupAuthTokenResponse> {
  if (isMockApi) {
    return mockGetMeetupAuthToken(meetupId)
  }

  return http<MeetupAuthTokenResponse>(`/meetups/${encodeURIComponent(meetupId)}/auth-token`)
}

export async function getAlbumPhotos(albumId: string): Promise<Photo[]> {
  if (isMockApi) {
    return mockGetAlbumPhotos(albumId)
  }

  return http<Photo[]>(`/albums/${encodeURIComponent(albumId)}/photos`)
}

export async function startMeetupSession(meetupId: string): Promise<SessionStartResponse> {
  if (isMockApi) {
    return mockStartMeetupSession(meetupId)
  }

  return http<SessionStartResponse>(`/meetups/${encodeURIComponent(meetupId)}/session`, {
    method: 'POST',
  })
}

export async function logPhotoEvent(params: {
  meetupId: string
  sessionId: string
  photoId: string
  photoIndex: number
  timestampMs: number
  navigatorUserId: string
}): Promise<void> {
  if (isMockApi) {
    mockLogPhotoEvent(params)
    return
  }

  const { meetupId, sessionId, photoId, photoIndex, timestampMs, navigatorUserId } = params

  await http(`/meetups/${encodeURIComponent(meetupId)}/photo-events`, {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      photo_id: photoId,
      photo_index: photoIndex,
      timestamp_ms: timestampMs,
      navigator_user_id: navigatorUserId,
    }),
  })
}

export async function getCurrentSessionState(meetupId: string): Promise<CurrentSessionState | null> {
  if (isMockApi) {
    return mockGetCurrentSessionState(meetupId)
  }

  try {
    return await http<CurrentSessionState>(`/meetups/${encodeURIComponent(meetupId)}/session/current`)
  } catch {
    // Endpoint is optional; treat errors as "no state"
    return null
  }
}

export async function getMeetupSummary(meetupId: string): Promise<MeetupSummaryResponse> {
  if (isMockApi) {
    return mockGetMeetupSummary(meetupId)
  }

  return http<MeetupSummaryResponse>(`/meetups/${encodeURIComponent(meetupId)}/summary`)
}

export async function getPhotoClips(photoId: string): Promise<PhotoClipsResponse> {
  if (isMockApi) {
    return mockGetPhotoClips(photoId)
  }

  return http<PhotoClipsResponse>(`/photos/${encodeURIComponent(photoId)}/meetup-clips`)
}

// ---------------------------------------------------------------------------
// In-memory mocks – used when API_BASE_URL is not set.
// These are deliberately simple but structurally match the real responses.
// ---------------------------------------------------------------------------

const MOCK_MEETUP_ID = 'demo-meetup'
const MOCK_ALBUM_ID = 'demo-album'

let mockSessionId: string | null = null
let mockRecordingStartTimestampMs: number | null = null
let mockCurrentPhotoIndex = 0

function createMockMeetup(meetupId: string): MeetupDetail {
  return {
    id: meetupId,
    title: 'Memories with Nanny',
    albumId: MOCK_ALBUM_ID,
    albumName: 'Sanibel Island Trip (1987)',
    recordedAt: '2023-08-25T14:30:00Z',
    durationSeconds: 47 * 60,
    photoCount: 12,
    prebuiltUrl:
      'https://demo-template.app.100ms.live/meeting/demo-room-code?userId=demo-user&name=Bill',
  }
}

function mockGetMeetup(meetupId: string): MeetupDetail {
  return createMockMeetup(meetupId || MOCK_MEETUP_ID)
}

function mockGetMeetupAuthToken(meetupId: string): MeetupAuthTokenResponse {
  // This token will not be valid against real 100ms infra – it is only here
  // so that the rest of the UI can run without backend wiring.
  const safeMeetupId = meetupId || MOCK_MEETUP_ID

  return {
    token: `mock-token-for-${safeMeetupId}`,
    userName: 'Bill',
    userId: 'user-bill-uuid',
  }
}

function mockGetAlbumPhotos(albumId: string): Photo[] {
  const baseAlbumId = albumId || MOCK_ALBUM_ID

  return Array.from({ length: 12 }).map((_, index) => {
    const photoIndex = index + 1

    return {
      id: `photo-${photoIndex}`,
      albumId: baseAlbumId,
      url: `https://images.pexels.com/photos/248797/pexels-photo-248797.jpeg?auto=compress&cs=tinysrgb&w=1200&q=80&random=${photoIndex}`,
      thumbnailUrl: `https://images.pexels.com/photos/248797/pexels-photo-248797.jpeg?auto=compress&cs=tinysrgb&w=300&q=80&random=${photoIndex}`,
      title: `Family memory #${photoIndex}`,
      index: photoIndex - 1,
    }
  })
}

function mockStartMeetupSession(meetupId: string): SessionStartResponse {
  const now = Date.now()

  mockSessionId = mockSessionId ?? `session-${meetupId || MOCK_MEETUP_ID}-${now}`
  mockRecordingStartTimestampMs = mockRecordingStartTimestampMs ?? now

  return {
    sessionId: mockSessionId,
    recordingStartTimestampMs: mockRecordingStartTimestampMs,
  }
}

function mockLogPhotoEvent(params: {
  meetupId: string
  sessionId: string
  photoId: string
  photoIndex: number
  timestampMs: number
  navigatorUserId: string
}): void {
  // For mock mode we just keep track of the latest photo index so that
  // getCurrentSessionState can return something meaningful.
  mockCurrentPhotoIndex = params.photoIndex
  // eslint-disable-next-line no-console
  console.debug('[mock] photo-event', params)
}

function mockGetCurrentSessionState(_meetupId: string): CurrentSessionState | null {
  if (mockSessionId == null) {
    return null
  }

  return {
    currentPhotoIndex: mockCurrentPhotoIndex,
  }
}

function mockGetMeetupSummary(meetupId: string): MeetupSummaryResponse {
  const base = createMockMeetup(meetupId)

  return {
    meetup_id: base.id,
    title: base.title,
    recorded_at: base.recordedAt ?? '2023-08-25T14:30:00Z',
    duration_seconds: base.durationSeconds ?? 0,
    participants: ['Bill', 'Dena', 'Susan'],
    photo_count: base.photoCount,
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
  }
}

function mockGetPhotoClips(photoId: string): PhotoClipsResponse {
  const base = createMockMeetup(MOCK_MEETUP_ID)

  return {
    photo_id: photoId,
    clips: [
      {
        meetup_id: base.id,
        meetup_title: base.title,
        clip_url: 'https://cdn.memrico.com/clips/demo-clip.mp4',
        thumbnail_url: 'https://cdn.memrico.com/thumbs/demo-thumb.jpg',
        duration_seconds: 45,
        transcript: {
          sentences: [
            {
              speaker: 'Bill',
              text: 'You know, I remember this day. We went to Sanibel Island right after Dad’s birthday.',
            },
            {
              speaker: 'Dena',
              text: "That’s right! And Mom made her famous crab cakes. Remember how Uncle Joe ate like six of them?",
            },
          ],
        },
        participants: ['Bill', 'Dena', 'Susan'],
        recorded_at: '2023-08-25T14:30:00Z',
      },
    ],
  }
}

