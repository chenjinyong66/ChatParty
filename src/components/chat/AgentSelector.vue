<template>
  <div class="agent-selector">
    <el-dropdown trigger="click" @command="handleSelectAgent">
      <el-button
        :type="agentStore.hasActiveAgent ? 'warning' : 'default'"
        size="small"
        class="agent-btn"
      >
        <el-icon class="agent-icon"><MagicStick /></el-icon>
        <span class="agent-label">{{ activeAgentName }}</span>
      </el-button>
      <template #dropdown>
        <el-dropdown-menu class="agent-dropdown-menu">
          <el-dropdown-item command="" class="agent-item">
            <el-icon><Close /></el-icon>
            <span>无智能体</span>
          </el-dropdown-item>
          <el-dropdown-item
            v-for="agent in agentStore.agents"
            :key="agent.id"
            :command="agent.id"
            class="agent-item"
            :class="{ 'is-active': agentStore.activeAgent?.id === agent.id }"
          >
            <el-icon><UserFilled /></el-icon>
            <div class="agent-info">
              <span class="agent-name">{{ agent.name }}</span>
              <span class="agent-desc">{{ agent.description }}</span>
            </div>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { MagicStick, Close, UserFilled } from '@element-plus/icons-vue'
import { useAgentStore } from '../../stores/agent'

const agentStore = useAgentStore()

const activeAgentName = computed(() => {
  return agentStore.activeAgent?.name || '智能体'
})

const handleSelectAgent = (agentId: string) => {
  if (!agentId) {
    agentStore.setActiveAgent(null)
    return
  }
  const agent = agentStore.agents.find(a => a.id === agentId)
  if (agent) {
    agentStore.setActiveAgent(agent)
  }
}
</script>

<style scoped>
.agent-selector {
  display: inline-flex;
  align-items: center;
}

.agent-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 16px;
}

.agent-icon {
  font-size: 14px;
}

.agent-label {
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
}

.agent-item.is-active {
  color: var(--el-color-warning);
  font-weight: 600;
}

.agent-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.agent-name {
  font-size: 13px;
  font-weight: 500;
}

.agent-desc {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
</style>
