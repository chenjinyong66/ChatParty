<template>
  <div class="custom-provider-manager">
    <div class="manager-header">
      <h3>自定义网站</h3>
      <el-button type="primary" size="small" @click="showAddDialog">
        添加网站
      </el-button>
    </div>

    <div v-if="customProviders.length === 0" class="empty-tip">
      <el-empty description="暂无自定义网站，点击上方按钮添加" :image-size="60" />
    </div>

    <div v-else class="provider-list">
      <div
        v-for="provider in customProviders"
        :key="provider.id"
        class="provider-card"
      >
        <div class="provider-main">
          <img :src="provider.icon" :alt="provider.name" class="provider-icon" @error="onIconError">
          <div class="provider-detail">
            <span class="provider-name">{{ provider.name }}</span>
            <span class="provider-url">{{ provider.url }}</span>
          </div>
        </div>
        <div class="provider-ops">
          <el-button size="small" @click="showEditDialog(provider)">
            编辑
          </el-button>
          <el-button size="small" @click="showScriptDialog(provider)">
            脚本
          </el-button>
          <el-button type="danger" size="small" @click="handleRemove(provider.id)">
            删除
          </el-button>
        </div>
      </div>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="isEditing ? '编辑网站' : '添加网站'"
      width="480px"
      destroy-on-close
    >
      <el-form :model="formData" label-width="80px">
        <el-form-item label="名称" required>
          <el-input v-model="formData.name" placeholder="如：MyGPT" />
        </el-form-item>
        <el-form-item label="网址" required>
          <el-input v-model="formData.url" placeholder="https://example.com" />
        </el-form-item>
        <el-form-item label="图标">
          <el-input v-model="formData.icon" placeholder="./icons/default.svg" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="scriptDialogVisible"
      title="自定义脚本配置"
      width="600px"
      destroy-on-close
    >
      <el-tabs v-model="scriptTab">
        <el-tab-pane label="登录检测" name="loginCheck">
          <el-input
            v-model="scriptData.loginCheckScript"
            type="textarea"
            :rows="6"
            placeholder="输入在 WebView 中执行的 JS 脚本，返回 true 表示已登录"
          />
          <p class="script-hint">脚本在 WebView 中执行，应返回布尔值。例如：!!document.querySelector('.user-avatar')</p>
        </el-tab-pane>
        <el-tab-pane label="发送消息" name="sendMessage">
          <el-input
            v-model="scriptData.sendMessageScript"
            type="textarea"
            :rows="6"
            placeholder="输入发送消息的 JS 脚本，变量 message 为待发送内容"
          />
        </el-tab-pane>
        <el-tab-pane label="新建对话" name="newChat">
          <el-input
            v-model="scriptData.newChatScript"
            type="textarea"
            :rows="4"
            placeholder="输入新建对话的 JS 脚本"
          />
        </el-tab-pane>
        <el-tab-pane label="文件上传" name="fileUpload">
          <el-input
            v-model="scriptData.fileUploadScript"
            type="textarea"
            :rows="6"
            placeholder="输入文件上传的 JS 脚本，变量 filePath 为文件路径"
          />
          <p class="script-hint">脚本用于模拟文件上传操作，通过注入方式触发目标网站的文件选择器或拖拽上传</p>
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <el-button @click="scriptDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveScripts">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useChatStore } from '../../stores'
import type { AIProvider, CustomProviderConfig } from '../../types'

const chatStore = useChatStore()

const customProviders = computed(() => chatStore.customProviders)

const dialogVisible = ref(false)
const isEditing = ref(false)
const editingId = ref('')
const formData = ref({ name: '', url: '', icon: './icons/default.svg' })

const scriptDialogVisible = ref(false)
const scriptTab = ref('loginCheck')
const scriptEditingId = ref('')
const scriptData = ref<CustomProviderConfig>({
  loginCheckScript: 'false',
  sendMessageScript: '',
  newChatScript: '',
  statusMonitorScript: '',
  fileUploadScript: ''
})

const showAddDialog = () => {
  isEditing.value = false
  editingId.value = ''
  formData.value = { name: '', url: '', icon: './icons/default.svg' }
  dialogVisible.value = true
}

const showEditDialog = (provider: AIProvider) => {
  isEditing.value = true
  editingId.value = provider.id
  formData.value = {
    name: provider.name,
    url: provider.url,
    icon: provider.icon
  }
  dialogVisible.value = true
}

const showScriptDialog = (provider: AIProvider) => {
  scriptEditingId.value = provider.id
  scriptData.value = {
    loginCheckScript: provider.customConfig?.loginCheckScript || 'false',
    sendMessageScript: provider.customConfig?.sendMessageScript || '',
    newChatScript: provider.customConfig?.newChatScript || '',
    statusMonitorScript: provider.customConfig?.statusMonitorScript || '',
    fileUploadScript: provider.customConfig?.fileUploadScript || ''
  }
  scriptTab.value = 'loginCheck'
  scriptDialogVisible.value = true
}

const handleSave = () => {
  if (!formData.value.name.trim()) {
    ElMessage.warning('请输入网站名称')
    return
  }
  if (!formData.value.url.trim()) {
    ElMessage.warning('请输入网站网址')
    return
  }

  if (isEditing.value) {
    chatStore.updateCustomProvider(editingId.value, {
      name: formData.value.name.trim(),
      url: formData.value.url.trim(),
      icon: formData.value.icon.trim()
    })
    ElMessage.success('网站已更新')
  } else {
    chatStore.addCustomProvider({
      name: formData.value.name.trim(),
      url: formData.value.url.trim(),
      icon: formData.value.icon.trim()
    })
    ElMessage.success('网站已添加')
  }
  dialogVisible.value = false
}

const handleSaveScripts = () => {
  chatStore.updateCustomProvider(scriptEditingId.value, {
    customConfig: { ...scriptData.value }
  })
  ElMessage.success('脚本配置已保存')
  scriptDialogVisible.value = false
}

const handleRemove = async(providerId: string) => {
  try {
    await ElMessageBox.confirm('确定删除该自定义网站？删除后不可恢复。', '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    chatStore.removeCustomProvider(providerId)
    ElMessage.success('已删除')
  } catch {
    // cancelled
  }
}

const onIconError = (e: Event) => {
  ;(e.target as HTMLImageElement).src = './icons/default.svg'
}
</script>

<style scoped>
.custom-provider-manager {
  padding: 0;
}

.manager-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.manager-header h3 {
  margin: 0;
  color: var(--el-text-color-primary);
}

.empty-tip {
  padding: 24px 0;
}

.provider-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.provider-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--el-bg-color-page);
  border-radius: 6px;
  border: 1px solid var(--el-border-color-lighter);
  transition: border-color 0.3s;
}

.provider-card:hover {
  border-color: var(--el-border-color);
}

.provider-main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.provider-icon {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  flex-shrink: 0;
}

.provider-detail {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.provider-name {
  font-weight: 500;
  color: var(--el-text-color-primary);
  font-size: 13px;
}

.provider-url {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.provider-ops {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.script-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}
</style>
