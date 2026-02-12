import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('./views/HomeView.vue'),
  },
  {
    path: '/meetups/:meetupId',
    name: 'meetup',
    component: () => import('./views/PreJoinView.vue'),
    props: true,
  },
  {
    path: '/meetups/:meetupId/room',
    name: 'meetup-room',
    component: () => import('./views/MeetupRoomView.vue'),
    props: true,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
