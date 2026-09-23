import { createRouter, createWebHashHistory } from 'vue-router'

import HomeView from '../views/HomeView.vue'
import ShapeMatchView from '../views/ShapeMatchView.vue'
import AiRecognitionView from '../views/AiRecognitionView.vue'

const router = createRouter({
  history: createWebHashHistory(),

  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/shape-match',
      name: 'shape-match',
      component: ShapeMatchView
    },
    {
      path: '/ai-recognition',
      name: 'ai-recognition',
      component: AiRecognitionView
    }
  ]
})

export default router