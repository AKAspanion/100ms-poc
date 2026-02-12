import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import HomeView from './views/HomeView.vue'
import PreJoinView from './views/PreJoinView.vue'
import MeetupRoomView from './views/MeetupRoomView.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
  },
  {
    path: '/meetups/:meetupId',
    name: 'meetup',
    component: PreJoinView,
    props: true,
  },
  {
    path: '/meetups/:meetupId/room',
    name: 'meetup-room',
    component: MeetupRoomView,
    props: true,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router

