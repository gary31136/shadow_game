<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const base = import.meta.env.BASE_URL

const animals = [
  {
    name: '鼠',
    image: base + 'images/rat.png'
  },
  {
    name: '牛',
    image: base + 'images/ox.png'
  },
  {
    name: '虎',
    image: base + 'images/tiger.png'
  },
  {
    name: '兔',
    image: base + 'images/rabbit.png'
  },
  {
    name: '龍',
    image: base + 'images/dragon.png'
  },
  {
    name: '蛇',
    image: base + 'images/snake.png'
  },
  {
    name: '馬',
    image: base + 'images/horse.png'
  },
  {
    name: '羊',
    image: base + 'images/goat.png'
  },
  {
    name: '猴',
    image: base + 'images/monkey.png'
  },
  {
    name: '雞',
    image: base + 'images/rooster.png'
  },
  {
    name: '狗',
    image: base + 'images/dog.png'
  },
  {
    name: '豬',
    image: base + 'images/pig.png'
  }
]

const shuffledAnimals = ref([])
const currentIndex = ref(0)
const videoRef = ref(null)
const cameraError = ref('')
let mediaStream = null
const canvasRef = ref(null)
const capturedImage = ref('')

function shuffleAnimals() {
  shuffledAnimals.value = [...animals]

  for (let i = shuffledAnimals.value.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))

    const temp = shuffledAnimals.value[i]
    shuffledAnimals.value[i] = shuffledAnimals.value[j]
    shuffledAnimals.value[j] = temp
  }

  currentIndex.value = 0
}

async function startCamera() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false
    })

    if (videoRef.value) {
      videoRef.value.srcObject = mediaStream
    }
  } catch (error) {
    console.error(error)
    cameraError.value = '無法開啟攝影機，請確認瀏覽器已允許攝影機權限。'
  }
}

function stopCamera() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop())
    mediaStream = null
  }
}

function capturePhoto() {
  const video = videoRef.value
  const canvas = canvasRef.value

  if (!video || !canvas) return

  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  const ctx = canvas.getContext('2d')

  // 讓拍下來的照片跟鏡子畫面方向一樣
  ctx.save()
  ctx.translate(canvas.width, 0)
  ctx.scale(-1, 1)

  ctx.drawImage(
    video,
    0,
    0,
    canvas.width,
    canvas.height
  )

  ctx.restore()

  capturedImage.value = canvas.toDataURL('image/png')
}

function retakePhoto() {
  capturedImage.value = ''
}

onMounted(() => {
  startCamera()
})

onBeforeUnmount(() => {
  stopCamera()
})


function nextQuestion() {
  capturedImage.value = ''

  currentIndex.value++

  if (currentIndex.value >= shuffledAnimals.value.length) {
    currentIndex.value = 0
  }
}

function previousQuestion() {
  capturedImage.value = ''

  currentIndex.value--

  if (currentIndex.value < 0) {
    currentIndex.value = shuffledAnimals.value.length - 1
  }
}

shuffleAnimals()
</script>

<template>
  <div class="game-container">

    <h1>🐾 十二生肖影子大挑戰</h1>

    <p class="instruction">
      看看左邊的影子，用你的手或身體模仿牠吧！
    </p>

    <div class="game-area">

      <!-- 左邊：題目剪影 -->
      <div class="panel">

        <h2>題目</h2>

        <div class="shadow-box">
          <img
            v-if="shuffledAnimals.length > 0"
            :src="shuffledAnimals[currentIndex].image"
            class="animal-image"
          >
        </div>

      </div>

      <!-- 右邊：攝影機 -->
      <div class="panel">

        <h2>換你來挑戰！</h2>

        <div class="camera-box">

          <!-- 還沒拍照時 -->
          <video
            v-show="!capturedImage"
            ref="videoRef"
            class="camera-video"
            autoplay
            playsinline
            muted
          ></video>

          <!-- 拍照後 -->
          <img
            v-if="capturedImage"
            :src="capturedImage"
            class="captured-image"
          >

          <!-- 攝影機錯誤訊息 -->
          <p
            v-if="cameraError"
            class="camera-error"
          >
            {{ cameraError }}
          </p>

        </div>

        <!-- 拍照按鈕 -->
        <div class="camera-buttons">

          <button
            v-if="!capturedImage"
            @click="capturePhoto"
            class="capture-button"
          >
            📸 拍下我的影子
          </button>

          <button
            v-else
            @click="retakePhoto"
            class="retake-button"
          >
            🔄 再拍一次
          </button>

        </div>

        <!-- 隱藏 Canvas -->
        <canvas
          ref="canvasRef"
          class="hidden-canvas"
        ></canvas>

      </div>

    </div>

    <!-- 下方按鈕 -->
    <div class="buttons">

      <button @click="previousQuestion">
        ← 上一題
      </button>

      <div class="question-number">
        {{ currentIndex + 1 }} / 12
      </div>

      <button @click="nextQuestion">
        下一題 →
      </button>

    </div>

  </div>
</template>

<style scoped>

.game-container {
  min-height: 100vh;
  box-sizing: border-box;
  text-align: center;
  padding: 30px;
  background-color: #fff8e7;
}

h1 {
  font-size: 40px;
  margin-top: 10px;
  margin-bottom: 10px;
}

.instruction {
  font-size: 22px;
  margin-bottom: 30px;
}


/* 左右兩個區域 */

.game-area {
  width: 90%;
  max-width: 1200px;
  margin: auto;

  display: flex;
  justify-content: center;
  align-items: stretch;

  gap: 30px;
}


/* 每一個區塊 */

.panel {
  flex: 1;

  background-color: white;

  padding: 25px;

  border-radius: 20px;

  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.12);
}

.panel h2 {
  font-size: 26px;
  margin-top: 0;
}


/* 左邊剪影區 */

.shadow-box {
  width: 100%;
  height: 420px;

  display: flex;
  justify-content: center;
  align-items: center;

  background-color: white;

  border-radius: 15px;
}

.animal-image {
  width: 90%;
  height: 90%;

  object-fit: contain;
}


/* 右邊攝影機區 */

.camera-box {
  width: 100%;
  height: 420px;

  display: flex;
  justify-content: center;
  align-items: center;

  background-color: #eeeeee;

  border: 4px dashed #bbbbbb;

  border-radius: 15px;

  box-sizing: border-box;

  position: relative;
  overflow: hidden;
}

.camera-placeholder {
  font-size: 70px;
  color: #777777;
}

.camera-placeholder p {
  font-size: 22px;
  margin-top: 10px;
}


/* 下方按鈕 */

.buttons {
  margin-top: 30px;

  display: flex;
  justify-content: center;
  align-items: center;

  gap: 30px;
}

button {
  font-size: 22px;

  padding: 15px 30px;

  border: none;

  border-radius: 12px;

  background-color: #ffd966;

  cursor: pointer;
}

button:hover {
  transform: scale(1.05);
}

.question-number {
  font-size: 20px;
  font-weight: bold;
}


/* 小螢幕自動改成上下排列 */

@media (max-width: 800px) {

  .game-area {
    flex-direction: column;
  }

  .shadow-box,
  .camera-box {
    height: 320px;
  }
}

.camera-video {
  width: 100%;
  height: 100%;
  object-fit: cover;

  border-radius: 12px;

  transform: scaleX(-1);
}

.camera-error {
  position: absolute;

  width: 80%;

  font-size: 18px;

  color: #c0392b;
}

.captured-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 12px;
}

.camera-buttons {
  margin-top: 18px;
}

.capture-button {
  background-color: #ffb347;
}

.retake-button {
  background-color: #9dd9f3;
}

.hidden-canvas {
  display: none;
}

</style>