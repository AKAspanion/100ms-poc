import type { User } from '../types.js';

// Demo users with host and guest types
export const MOCK_MEETUP_ID = 'demo-meetup';

const users = new Map<string, User>([
  [
    'demo-user-1',
    {
      id: 'demo-user-1',
      name: 'ankit',
      email: 'demo-user-1@memrico.local',
      type: 'host',
      // Simple role mapping per meetup – extend as needed.
      rolesByMeetup: {
        [MOCK_MEETUP_ID]: 'host',
      },
    },
  ],
  [
    'demo-user-2',
    {
      id: 'demo-user-2',
      name: 'mom',
      email: 'demo-user-2@memrico.local',
      type: 'guest',
      rolesByMeetup: {
        [MOCK_MEETUP_ID]: 'guest',
      },
    },
  ],
  [
    'demo-user-3',
    {
      id: 'demo-user-3',
      name: 'dad',
      email: 'demo-user-3@memrico.local',
      type: 'guest',
      rolesByMeetup: {
        [MOCK_MEETUP_ID]: 'guest',
      },
    },
  ],
  [
    'demo-user-4',
    {
      id: 'demo-user-4',
      name: 'sister',
      email: 'demo-user-4@memrico.local',
      type: 'guest',
      rolesByMeetup: {
        [MOCK_MEETUP_ID]: 'guest',
      },
    },
  ],
  [
    'demo-user-5',
    {
      id: 'demo-user-5',
      name: 'brother',
      email: 'demo-user-5@memrico.local',
      type: 'guest',
      rolesByMeetup: {
        [MOCK_MEETUP_ID]: 'guest',
      },
    },
  ],
]);

export { users };
