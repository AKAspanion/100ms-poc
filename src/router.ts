import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    // @ts-expect-error - Vue SFC dynamic import
    component: () => import('./views/HomeView.vue'),
  },
  {
    path: '/meetups/:meetupId',
    name: 'meetup',
    // @ts-expect-error - Vue SFC dynamic import
    component: () => import('./views/PreJoinView.vue'),
    props: true,
  },
  {
    path: '/meetups/:meetupId/room',
    name: 'meetup-room',
    // @ts-expect-error - Vue SFC dynamic import
    component: () => import('./views/MeetupRoomView.vue'),
    props: true,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
