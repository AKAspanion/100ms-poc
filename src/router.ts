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
    component: () => import('./views/MeetupView.vue'),
    props: true,
  },
  {
    path: '/meetups/:meetupId/room',
    redirect: (to) => ({ name: 'meetup', params: to.params }),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
