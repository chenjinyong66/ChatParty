<template>
  <div class="settings-view">
    <div class="settings-container">
      <el-card class="settings-card">
        <template #header>
          <div class="card-header">
            <el-icon>
              <Setting />
            </el-icon>
            <span>应用设置</span>
          </div>
        </template>

        <el-tabs v-model="activeTab" class="settings-tabs">
          <!-- 通用设置 -->
          <el-tab-pane label="通用" name="general">
            <div class="settings-section">
              <h3>外观设置</h3>
              <el-form label-width="120px">
                <el-form-item label="主题模式">
                  <el-radio-group v-model="userPreferences.theme" @change="handleThemeChange">
                    <el-radio label="light">
                      浅色
                    </el-radio>
                    <el-radio label="dark">
                      深色
                    </el-radio>
                    <el-radio label="auto">
                      跟随系统
                    </el-radio>
                  </el-radio-group>
                </el-form-item>


              </el-form>
            </div>

            <el-divider />

            <div class="settings-section">
              <h3>功能设置</h3>
              <el-form label-width="120px">
                <el-form-item label="自动保存">
                  <el-switch v-model="userPreferences.autoSave" @change="handleAutoSaveChange" />
                </el-form-item>

                <el-form-item label="桌面通知">
                  <el-switch v-model="userPreferences.notifications" @change="handleNotificationsChange" />
                </el-form-item>
              </el-form>
            </div>
          </el-tab-pane>

          <!-- 会话管理 -->
          <el-tab-pane label="会话管理" name="sessions">
            <SessionStatus :providers="providers" />
          </el-tab-pane>

          <!-- 布局设置 -->
          <el-tab-pane label="布局" name="layout">
            <div class="settings-section">
              <h3>网格布局</h3>
              <el-form label-width="120px">
                <el-form-item label="列数">
                  <el-input-number v-model="gridSettings.columns" :min="1" :max="6" @change="handleGridChange" />
                </el-form-item>

                <el-form-item label="间距">
                  <el-input-number v-model="gridSettings.gap" :min="8" :max="32" @change="handleGridChange" />
                </el-form-item>
              </el-form>

              <el-button type="primary" @click="resetLayout">
                重置布局
              </el-button>
            </div>
          </el-tab-pane>

          <!-- 脚本配置 -->
          <el-tab-pane label="脚本配置" name="scripts">
            <ScriptEditor />
          </el-tab-pane>

          <!-- 自定义网站 -->
          <el-tab-pane label="自定义网站" name="custom">
            <CustomProviderManager />
          </el-tab-pane>

          <!-- 关于 -->
          <el-tab-pane label="关于" name="about">
            <div class="about-page">
              <div class="about-section">
                <h3>问题或建议反馈</h3>
                <p>如有任何问题或功能建议，欢迎提交 Issue：</p>
                <div class="copy-link-row">
                  <el-link type="primary" href="https://github.com/chenjinyong66/ChatParty/issues" target="_blank">
                    GitHub Issues →
                  </el-link>
                  <el-button size="small" text
                    @click="copyToClipboard('https://github.com/chenjinyong66/ChatParty/issues')">
                    复制链接
                  </el-button>
                </div>
              </div>

              <el-divider />

              <div class="about-section">
                <h3>项目推荐</h3>
                <div class="recommend-card">
                  <div class="recommend-header">
                    <span class="recommend-name">EyeCare</span>
                    <el-tag size="small" type="success">推荐</el-tag>
                  </div>
                  <p class="recommend-desc">
                    开源 AI 智能健康桌面应用 (Tauri v2 + Rust)｜护眼休息提醒 · 喝水提醒 · 用药提醒｜眼睛生命值 · 宠物养成 · 20-20-20法则 · 久坐检测
                  </p>
                  <div class="copy-link-row">
                    <el-link type="primary" href="https://github.com/guangshu100/EyeCare/releases" target="_blank">
                      了解更多 →
                    </el-link>
                    <el-button size="small" text
                      @click="copyToClipboard('https://github.com/guangshu100/EyeCare/releases')">
                      复制链接
                    </el-button>
                  </div>
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Setting } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import SessionStatus from '../components/session/SessionStatus.vue'
import ScriptEditor from '../components/settings/ScriptEditor.vue'
import CustomProviderManager from '../components/settings/CustomProviderManager.vue'
import { useAppStore, useLayoutStore, useChatStore } from '../stores'

const appStore = useAppStore()
const layoutStore = useLayoutStore()
const chatStore = useChatStore()

// 响应式数据
const activeTab = ref('general')

// 计算属性
const userPreferences = computed(() => appStore.userPreferences)
const gridSettings = computed(() => layoutStore.gridSettings)
const providers = computed(() => chatStore.providers)

const handleThemeChange = (theme: string): void => {
  appStore.updateTheme(theme as 'light' | 'dark' | 'auto')
  ElMessage.success('主题设置已更新')
}

const handleAutoSaveChange = (value: boolean): void => {
  appStore.saveUserPreferences()
  ElMessage.success('设置已更新')
}

/**
 * 处理通知变化
 */
const handleNotificationsChange = (value: boolean): void => {
  appStore.saveUserPreferences()
  ElMessage.success(`桌面通知已${value ? '开启' : '关闭'}`)
}

/**
 * 处理网格设置变化
 */
const handleGridChange = (): void => {
  layoutStore.updateGridSettings(gridSettings.value)
  ElMessage.success('布局设置已更新')
}

/**
 * 重置布局
 */
const resetLayout = (): void => {
  layoutStore.resetLayout()
  ElMessage.success('布局已重置')
}

const copyToClipboard = async (text: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('链接已复制')
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    ElMessage.success('链接已复制')
  }
}
</script>

<style scoped>
.settings-view {
  height: 100%;
  padding: 20px;
  overflow-y: auto;
}

.settings-container {
  max-width: 800px;
  margin: 0 auto;
}

.settings-card {
  box-shadow: var(--el-box-shadow-light);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
}

.settings-tabs {
  margin-top: 20px;
}

.settings-section {
  margin-bottom: 24px;
}

.settings-section h3 {
  margin: 0 0 16px 0;
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
}

.about-page {
  max-width: 520px;
  margin: 0 auto;
}

.about-section {
  margin-bottom: 20px;
}

.about-section h3 {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.about-section p {
  margin: 4px 0;
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.6;
}

.recommend-card {
  padding: 14px;
  background: var(--el-bg-color-page);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
}

.recommend-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.recommend-name {
  font-weight: 600;
  font-size: 15px;
  color: var(--el-text-color-primary);
}

.recommend-desc {
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.7;
  margin: 0 0 10px;
}
</style>
