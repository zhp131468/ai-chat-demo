<template>
  <div class="chat-container">
    <div class="chat-header">
      <h2>Vue3 AI 流式对话 Demo</h2>
      <div class="header-btn">
        <el-button v-if="streaming" type="warning" size="small" @click="stopStream">停止输出</el-button>
        <el-button type="danger" size="small" @click="clearChat">清空对话</el-button>
      </div>
    </div>

    <div class="chat-content" ref="scrollRef">
      <div v-for="(item, index) in chatList" :key="index" class="chat-item">
        <div v-if="item.role === 'user'" class="user-msg msg-box">
          <div class="msg-label">我</div>
          <div class="msg-text">
            <template v-if="item.imageUrl">
              <el-image
                class="chat-thumb"
                :src="item.imageUrl"
                fit="cover"
                :preview-src-list="[item.imageUrl]"
                preview-teleported
              />
            </template>
            <div v-if="item.content" class="msg-content">{{ item.content }}</div>
          </div>
        </div>

        <div v-else class="ai-msg msg-box">
          <div class="msg-label">AI助手</div>
          <div class="msg-text ai-content" @click="handleRenderedClick">
            <div v-if="item.loading && !item.content && !(item.images && item.images.length)" class="thinking-bubble" aria-busy="true">
              <span class="thinking-text">正在思考</span>
              <span class="thinking-dots" aria-hidden="true"><i></i><i></i><i></i></span>
            </div>
            <div v-if="item.images && item.images.length" class="assistant-images">
              <el-image
                v-for="(img, imgIndex) in item.images"
                :key="`${index}-${imgIndex}`"
                class="assistant-image"
                :src="img"
                fit="contain"
                :preview-src-list="item.images"
                preview-teleported
              />
            </div>
            <div v-if="imageStatus" class="image-status">{{ imageStatus }}</div>
            <div v-if="item.content" class="markdown-body" v-html="renderMarkdown(item.content)"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="chat-input">
      <div class="context-panel" :class="{ active: visualContextUrl }">
        <div class="context-left">
          <div class="context-label">{{ visualContextLabel }}</div>
          <div v-if="visualContextUrl" class="context-desc">继续发送文字会基于当前图片调用视觉模型。</div>
          <div v-else class="context-desc">未选择图片时，会走纯文本对话。</div>
        </div>
        <div class="context-actions">
          <el-image
            v-if="visualContextUrl"
            class="context-thumb"
            :src="visualContextUrl"
            fit="cover"
            :preview-src-list="[visualContextUrl]"
            preview-teleported
          />
          <el-button v-if="visualContextUrl" size="small" @click="switchToTextMode">切回纯文本</el-button>
        </div>
      </div>

      <div v-if="selectedImage" class="image-preview-bar">
        <div class="preview-info">
          <el-image class="preview-thumb" :src="selectedImage.dataUrl" fit="cover" preview-teleported />
          <span class="preview-name">{{ selectedImage.name }}</span>
        </div>
        <el-button text type="danger" @click="removeSelectedImage">移除</el-button>
      </div>

      <el-input
        v-model="inputText"
        type="textarea"
        :rows="3"
        placeholder="输入内容回车发送，支持上传图片后做识图或修图"
        @keyup.enter="handleSend"
        resize="none"
      />

      <div class="input-actions">
        <input ref="imageInputRef" class="hidden-file-input" type="file" accept="image/*" @change="handleImageChange" />
        <el-button @click="triggerImageSelect">上传图片</el-button>
        <el-button class="send-btn" type="primary" @click="handleSend" :loading="loading && !streaming">
          发送
        </el-button>
      </div>
    </div>

    <el-dialog v-model="previewVisible" width="80%" align-center class="image-preview-dialog">
      <img class="preview-image" :src="previewUrl" alt="图片预览" />
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref, nextTick, watch, onBeforeUnmount } from 'vue'
import MarkdownIt from 'markdown-it'
import { ElMessage } from 'element-plus'
import { request } from '../utils/request'

const md = new MarkdownIt({
  linkify: true,
  breaks: true
})

md.renderer.rules.image = (tokens, idx) => {
  const token = tokens[idx]
  const src = token.attrGet('src') || ''
  const alt = token.content || ''
  const escapedSrc = md.utils.escapeHtml(src)
  const escapedAlt = md.utils.escapeHtml(alt)
  return `<img class="chat-image" src="${escapedSrc}" alt="${escapedAlt}" data-src="${escapedSrc}" loading="lazy" />`
}

const scrollRef = ref(null)
const imageInputRef = ref(null)
const inputText = ref('')
const loading = ref(false)
const streaming = ref(false)
const chatList = ref([])
const selectedImage = ref(null)
const editImageUrl = ref('')
const imageStatus = ref('')
const imageElapsed = ref(0)
let imageTimer = null
const previewVisible = ref(false)
const previewUrl = ref('')
let abortController = null

const visualContextUrl = computed(() => selectedImage.value?.dataUrl || editImageUrl.value || '')
const visualContextLabel = computed(() => {
  if (selectedImage.value?.dataUrl) return '当前编辑源：本次上传图片'
  if (editImageUrl.value) return '当前编辑源：上一轮生成图片'
  return '当前模式：纯文本对话'
})

const renderMarkdown = (str) => md.render(str || '')

const scrollToBottom = async () => {
  await nextTick()
  if (scrollRef.value) {
    scrollRef.value.scrollTop = scrollRef.value.scrollHeight
  }
}

const openPreview = (src) => {
  previewUrl.value = src
  previewVisible.value = true
}

const handleRenderedClick = (event) => {
  const target = event.target instanceof Element ? event.target : null
  if (!target) return

  const imageNode = target.closest('img.chat-image')
  if (imageNode) {
    const src = imageNode.getAttribute('data-src') || imageNode.getAttribute('src') || ''
    if (src) openPreview(src)
  }
}

watch(chatList, scrollToBottom, { deep: true })

const stopStream = () => {
  if (abortController) {
    abortController.abort()
    abortController = null
  }
  streaming.value = false
  loading.value = false
}

const triggerImageSelect = () => {
  imageInputRef.value?.click()
}

const readFileAsDataUrl = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}

const handleImageChange = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    event.target.value = ''
    return
  }

  if (file.size > 10 * 1024 * 1024) {
    ElMessage.warning('图片不能大于 10MB')
    event.target.value = ''
    return
  }

  try {
    const dataUrl = await readFileAsDataUrl(file)
    selectedImage.value = { file, name: file.name, dataUrl }
  } catch (err) {
    ElMessage.error('图片读取失败')
  } finally {
    event.target.value = ''
  }
}

const removeSelectedImage = () => {
  selectedImage.value = null
}

const setEditImage = (url) => {
  editImageUrl.value = url || ''
}

const switchToTextMode = () => {
  removeSelectedImage()
  setEditImage('')
}

const parseSseChunk = (chunk, sseBuffer, onData) => {
  let buffer = sseBuffer + chunk
  let frameEndIndex = buffer.indexOf('\n\n')

  while (frameEndIndex !== -1) {
    const frame = buffer.slice(0, frameEndIndex)
    buffer = buffer.slice(frameEndIndex + 2)

    const dataLines = frame.split(/\r?\n/).filter((line) => line.startsWith('data:'))
    for (const line of dataLines) {
      const payload = line.replace(/^data:\s*/, '').trim()
      if (payload) onData(payload)
    }

    frameEndIndex = buffer.indexOf('\n\n')
  }

  return buffer
}

const sendTextChat = async (prompt) => {
  const aiMsgItem = { role: 'assistant', content: '', images: [], loading: true }
  chatList.value.push(aiMsgItem)

  let receivedText = ''
  let sseBuffer = ''
  let receivedFirstChunk = false

  const appendSseText = (textChunk) => {
    sseBuffer = parseSseChunk(textChunk, sseBuffer, (payload) => {
      if (payload === '[DONE]') {
        stopStream()
        return
      }
      if (!receivedFirstChunk) {
        receivedFirstChunk = true
        aiMsgItem.loading = false
      }
      aiMsgItem.content += payload
    })
  }

  abortController = new AbortController()
  streaming.value = true
  loading.value = true

  await request.raw({
    url: '/stream-chat',
    method: 'post',
    data: { prompt },
    headers: { 'Content-Type': 'application/json' },
    responseType: 'text',
    timeout: 0,
    signal: abortController.signal,
    onDownloadProgress: (progressEvent) => {
      const xhr = progressEvent.event?.target
      const responseText = xhr?.responseText || ''
      const chunk = responseText.slice(receivedText.length)
      receivedText = responseText
      if (chunk) appendSseText(chunk)
    }
  })

  parseSseChunk('', sseBuffer, (payload) => {
    if (payload === '[DONE]') {
      stopStream()
      return
    }
    aiMsgItem.content += payload
  })
}


const startImageTimer = () => {
  imageElapsed.value = 0
  imageTimer = setInterval(() => {
    imageElapsed.value++
  }, 1000)
}

const stopImageTimer = () => {
  if (imageTimer) {
    clearInterval(imageTimer)
    imageTimer = null
  }
}

const sendImageEdit = async (prompt, imageDataUrl) => {
  const aiMsgItem = { role: 'assistant', content: '', images: [], loading: true }
  chatList.value.push(aiMsgItem)

  imageStatus.value = '📤 图片上传完成'
  startImageTimer()

  setTimeout(() => {
    if (imageStatus.value) {
      imageStatus.value = '🎨 AI正在生成图片...'
    }
  }, 800)

  abortController = new AbortController()
  loading.value = true
  streaming.value = false

  const response = await request.post(
    '/image-edit',
    {
      prompt,
      image: imageDataUrl
    },
    {
      timeout:120000,
      signal: abortController.signal
    }
  )

  aiMsgItem.content = response?.text || '图片已生成'
  aiMsgItem.images = Array.isArray(response?.images) ? response.images : []
  aiMsgItem.loading = false
  imageStatus.value = `✅ 图片生成完成，耗时 ${imageElapsed.value} 秒`
  stopImageTimer()

  setEditImage(aiMsgItem.images[0] || imageDataUrl)

  loading.value = false
  abortController = null
}

const handleSend = async () => {
  const text = inputText.value.trim()
  const imageDataUrl = selectedImage.value?.dataUrl || editImageUrl.value || ''

  if (!text && !imageDataUrl) return
  if (loading.value || streaming.value) return

  const displayText = text || '请帮我处理这张图片。'

  chatList.value.push({
    role: 'user',
    content: displayText,
    imageUrl: imageDataUrl
  })

  inputText.value = ''
  removeSelectedImage()
  scrollToBottom()

  loading.value = true

  try {
    if (imageDataUrl) {
      await sendImageEdit(displayText, imageDataUrl)
    } else {
      await sendTextChat(displayText)
    }
  } catch (err) {
    if (err.name !== 'AbortError' && err.code !== 'ERR_CANCELED') {
      stopStream()
      const aiMsgItem = chatList.value[chatList.value.length - 1]
      if (aiMsgItem && aiMsgItem.role === 'assistant') {
        aiMsgItem.content = aiMsgItem.content || '连接失败，请检查后端服务是否启动。'
      }
      console.error('请求异常', err)
    }
  } finally {
    abortController = null
    streaming.value = false
    loading.value = false
  }
}

const clearChat = () => {
  stopStream()
  chatList.value = []
  removeSelectedImage()
  setEditImage('')
  inputText.value = ''
}

onBeforeUnmount(() => {
  stopStream()
  stopImageTimer()
})
</script>

<style scoped>
.chat-container {
  width: 100%;
  max-width: 900px;
  height: 100vh;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  border: 1px solid #e4e7ed;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid #e4e7ed;
}

.header-btn {
  display: flex;
  gap: 8px;
}

.chat-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  background-color: #fafafa;
}

.chat-item {
  margin-bottom: 16px;
}

.msg-box {
  max-width: 70%;
}

.user-msg {
  margin-left: auto;
}

.ai-msg {
  margin-right: auto;
}

.msg-label {
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
}

.user-msg .msg-text {
  background-color: #409eff;
  color: #fff;
  padding: 10px 14px;
  border-radius: 8px 2px 8px 8px;
  white-space: pre-wrap;
}

.msg-content {
  margin-top: 8px;
  white-space: pre-wrap;
}

.ai-msg .msg-text {
  background-color: #fff;
  border: 1px solid #e4e7ed;
  padding: 10px 14px;
  border-radius: 2px 8px 8px 8px;
}

.ai-content {
  white-space: normal;
}

.markdown-body {
  white-space: pre-wrap;
}

.assistant-images {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.assistant-image {
  width: 100%;
  min-height: 160px;
  border-radius: 10px;
  overflow: hidden;
  cursor: zoom-in;
}

.chat-thumb {
  width: 140px;
  height: 140px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  display: block;
}

.thinking-box {
  max-width: 260px;
}

.thinking-bubble {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding: 12px 16px;
}

.thinking-text {
  color: #1f2d3d;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.thinking-dots {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.thinking-dots i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #409eff;
  display: inline-block;
  animation: thinkingPulse 1s infinite ease-in-out;
}

.thinking-dots i:nth-child(2) {
  animation-delay: 0.15s;
}

.thinking-dots i:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes thinkingPulse {
  0%,
  80%,
  100% {
    transform: translateY(0) scale(0.65);
    opacity: 0.45;
  }
  40% {
    transform: translateY(-2px) scale(1);
    opacity: 1;
  }
}

.context-panel {
  width: stretch;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  background: #fff;
}

.context-panel.active {
  border-color: #409eff;
  background: linear-gradient(180deg, #eef6ff 0%, #ffffff 100%);
}

.context-left {
  min-width: 0;
}

.context-label {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.context-desc {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}

.context-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
}

.context-thumb {
  width: 42px;
  height: 42px;
  border-radius: 8px;
  overflow: hidden;
  cursor: zoom-in;
}

.image-preview-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  padding: 10px 12px;
  border: 1px dashed #d9d9d9;
  border-radius: 10px;
  background: #fff;
}

.preview-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.preview-thumb {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  overflow: hidden;
  flex: 0 0 auto;
}

.preview-name {
  font-size: 13px;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-input {
  padding: 12px 16px;
  border-top: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-end;
}

.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  width: 100%;
}

.chat-input .el-textarea {
  width: 100%;
}

.send-btn {
  width: 90px;
}

.hidden-file-input {
  display: none;
}

:deep(pre) {
  background: #2d2d2d;
  color: #fff;
  padding: 10px;
  border-radius: 6px;
  overflow-x: auto;
}

:deep(code) {
  background: #f0f0f0;
  padding: 2px 4px;
  border-radius: 3px;
}

:deep(pre code) {
  background: transparent;
}

:deep(img.chat-image) {
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  cursor: zoom-in;
  margin: 8px 0;
}

:deep(a) {
  color: #409eff;
  word-break: break-all;
}

.image-preview-dialog :deep(.el-dialog__body) {
  display: flex;
  justify-content: center;
}

.preview-image {
  max-width: 100%;
  max-height: 80vh;
  object-fit: contain;
}
</style>

<style scoped>
.image-status {
  margin: 10px 16px;
  padding: 12px 16px;
  border-radius: 8px;
  background: #f0f9ff;
  color: #409eff;
  font-size: 14px;
  display: flex;
  justify-content: space-between;
}
</style>
