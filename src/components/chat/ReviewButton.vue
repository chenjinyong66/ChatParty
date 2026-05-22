<template>
  <el-button
    type="danger"
    :icon="DataAnalysis"
    size="small"
    :disabled="!canReview"
    :loading="reviewStore.isReviewing"
    title="评审各AI的回答质量"
    data-testid="review-button"
    @click="handleReview"
  >
    评审
  </el-button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { DataAnalysis } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useChatStore } from '../../stores'
import { useReviewStore } from '../../stores/review'
import { reviewService } from '../../services/ReviewService'

const chatStore = useChatStore()
const reviewStore = useReviewStore()

const canReview = computed(() => {
  const loggedInCount = chatStore.loggedInCount
  return loggedInCount >= 2 && reviewStore.canStartReview
})

const handleReview = async () => {
  try {
    const providers = chatStore.loggedInProviders
    const providerNames = providers.map(p => p.name)

    const { value: reviewerId } = await ElMessageBox.prompt(
      '请选择评审模型（该模型将评审其他模型的回答）',
      'AI评审',
      {
        confirmButtonText: '开始评审',
        cancelButtonText: '取消',
        inputPlaceholder: providerNames.join(' / '),
        inputValue: providers[0]?.id || '',
        inputValidator: (val: string) => {
          if (!val) return '请输入评审模型ID'
          if (!providers.find(p => p.id === val)) return `无效的模型ID，可选: ${providerNames.join(', ')}`
          return true
        }
      }
    )

    if (reviewerId) {
      await reviewService.executeReview(
        chatStore.currentMessage || '最近的问题',
        providers,
        reviewerId
      )
    }
  } catch {
    // 用户取消
  }
}
</script>
