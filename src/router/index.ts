import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/chat',
    name: 'Root',
    meta: {
      title: 'ChatParty - 多模型对话'
    }
  },
  {
    path: '/chat',
    name: 'Chat',
    component: () => import('../views/Chat.vue'),
    meta: {
      title: 'ChatParty - 对话'
    }
  }
]

// 根据环境变量决定是否添加工具集路由
if (import.meta.env.VITE_ENABLE_TOOLSET === 'true') {
  routes.push({
    path: '/toolset',
    name: 'Toolset',
    component: () => import('../views/Toolset.vue'),
    meta: {
      title: 'ChatParty - 工具集'
    }
  })
}

routes.push({
  path: '/settings',
  name: 'Settings',
  component: () => import('../views/Settings.vue'),
  meta: {
    title: 'ChatParty - 设置'
  }
})

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 路由守卫 - 设置页面标题
router.beforeEach((to, from, next) => {
  if (to.meta?.title) {
    document.title = to.meta.title as string
  }
  next()
})

export default router
