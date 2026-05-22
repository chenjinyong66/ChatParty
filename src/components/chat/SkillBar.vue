<template>
  <div class="skill-bar">
    <div class="skill-tags">
      <el-check-tag
        v-for="skill in agentStore.skills"
        :key="skill.id"
        :checked="isSkillActive(skill.id)"
        class="skill-tag"
        @change="(checked: boolean) => handleToggleSkill(skill, checked)"
      >
        <el-icon :size="12"><Promotion /></el-icon>
        <span>{{ skill.name }}</span>
      </el-check-tag>
    </div>
    <el-button
      v-if="agentStore.hasActiveTransform"
      size="small"
      text
      type="danger"
      class="clear-btn"
      @click="handleClearAll"
    >
      清除全部
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { Promotion } from '@element-plus/icons-vue'
import { useAgentStore } from '../../stores/agent'
import type { Skill } from '../../types/agent'

const agentStore = useAgentStore()

const isSkillActive = (skillId: string): boolean => {
  return agentStore.activeSkills.some(s => s.id === skillId)
}

const handleToggleSkill = (skill: Skill, checked: boolean) => {
  agentStore.toggleSkill(skill, checked)
}

const handleClearAll = () => {
  agentStore.clearAll()
}
</script>

<style scoped>
.skill-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  flex-wrap: wrap;
}

.skill-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.skill-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 12px;
  cursor: pointer;
  user-select: none;
}

.clear-btn {
  font-size: 11px;
  padding: 2px 6px;
}
</style>
