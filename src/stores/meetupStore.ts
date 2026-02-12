import { defineStore } from 'pinia';
import type { CurrentSessionState, MeetupDetail, Photo } from '../api/types';
import {
  getAlbumPhotos,
  getCurrentSessionState,
  getMeetup,
  startMeetupSession,
} from '../api/client';

interface MeetupState {
  currentMeetup: MeetupDetail | null;
  photos: Photo[];
  currentPhotoIndex: number;
  sessionId: string | null;
  recordingStartTimestampMs: number | null;
  hmsAuthToken: string | null;
  currentUserName: string | null;
  currentUserId: string | null;
  isLoading: boolean;
  errorMessage: string | null;
  virtualBackgroundMode: 'none' | 'blur' | 'image';
  virtualBackgroundImageUrl: string | null;
  preferredCameraOn: boolean;
  preferredMicOn: boolean;
}

export const useMeetupStore = defineStore('meetup', {
  state: (): MeetupState => ({
    currentMeetup: null,
    photos: [],
    currentPhotoIndex: 0,
    sessionId: null,
    recordingStartTimestampMs: null,
    hmsAuthToken: null,
    currentUserName: null,
    currentUserId: null,
    isLoading: false,
    errorMessage: null,
    virtualBackgroundMode: 'none',
    virtualBackgroundImageUrl: null,
    preferredCameraOn: true,
    preferredMicOn: true,
  }),

  getters: {
    currentPhoto(state): Photo | null {
      if (!state.photos.length) {
        return null;
      }

      if (state.currentPhotoIndex < 0 || state.currentPhotoIndex >= state.photos.length) {
        return state.photos[0] || null;
      }

      return state.photos[state.currentPhotoIndex] || null;
    },
  },

  actions: {
    setPreferredCamera(on: boolean) {
      this.preferredCameraOn = on;
    },

    setPreferredMic(on: boolean) {
      this.preferredMicOn = on;
    },

    setError(message: string | null) {
      this.errorMessage = message;
    },

    setCurrentPhotoIndex(index: number) {
      if (!this.photos.length) {
        this.currentPhotoIndex = 0;
        return;
      }

      const clampedIndex = Math.min(Math.max(index, 0), this.photos.length - 1);
      this.currentPhotoIndex = clampedIndex;
    },

    setVirtualBackground(mode: 'none' | 'blur' | 'image', imageUrl?: string | null) {
      this.virtualBackgroundMode = mode;
      this.virtualBackgroundImageUrl =
        mode === 'image' ? (imageUrl ?? this.virtualBackgroundImageUrl) : null;
    },

    async loadMeetup(meetupId: string) {
      this.isLoading = true;
      this.errorMessage = null;

      try {
        this.currentMeetup = await getMeetup(meetupId);
      } catch (error) {
        this.errorMessage = (error as Error).message || 'Failed to load meetup.';
      } finally {
        this.isLoading = false;
      }
    },

    async startSession(meetupId: string) {
      try {
        const response = await startMeetupSession(meetupId);
        this.sessionId = response.sessionId;
        this.recordingStartTimestampMs = response.recordingStartTimestampMs;
      } catch (error) {
        this.errorMessage = (error as Error).message || 'Failed to start meetup session.';
      }
    },

    async loadPhotos() {
      if (!this.currentMeetup) {
        return;
      }

      try {
        this.photos = await getAlbumPhotos(this.currentMeetup.albumId);
        if (this.photos.length) {
          this.currentPhotoIndex = 0;
        }
      } catch (error) {
        this.errorMessage = (error as Error).message || 'Failed to load album photos.';
      }
    },

    async loadCurrentSessionState(meetupId: string) {
      let state: CurrentSessionState | null = null;

      try {
        state = await getCurrentSessionState(meetupId);
      } catch {
        // Endpoint is optional; ignore any errors here.
      }

      if (state && typeof state.currentPhotoIndex === 'number') {
        this.setCurrentPhotoIndex(state.currentPhotoIndex);
      }
    },
  },
});
