<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision'

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
const silhouetteImage = ref('')
const isCompleted = ref(false)

const segmenterReady = ref(false)
const opencvReady = ref(false)
const similarityScore = ref(null)
const isComparing = ref(false)
const compareError = ref('')
const isProcessingSilhouette = ref(false)
const segmenterError = ref('')

let imageSegmenter = null

function waitForOpenCV() {
  const timer = setInterval(() => {
    if (
      window.cv &&
      typeof window.cv.imread === 'function'
    ) {
      opencvReady.value = true

      console.log('OpenCV 載入完成')

      clearInterval(timer)
    }
  }, 200)
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()

    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('圖片載入失敗'))

    img.src = src
  })
}


function getLargestContour(imgElement) {
  const src = cv.imread(imgElement)

  const gray = new cv.Mat()
  const binary = new cv.Mat()
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()

  // 彩色 → 灰階
  cv.cvtColor(
    src,
    gray,
    cv.COLOR_RGBA2GRAY
  )

  /*
    我們的圖片是：
    黑色剪影 + 白色背景

    THRESH_BINARY_INV 會變成：
    剪影 = 白色
    背景 = 黑色

    這樣 OpenCV 比較好抓輪廓
  */
  cv.threshold(
    gray,
    binary,
    127,
    255,
    cv.THRESH_BINARY_INV
  )

  cv.findContours(
    binary,
    contours,
    hierarchy,
    cv.RETR_EXTERNAL,
    cv.CHAIN_APPROX_SIMPLE
  )

  let largestContour = null
  let largestArea = 0

  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i)

    const area = cv.contourArea(contour)

    if (area > largestArea) {

      if (largestContour) {
        largestContour.delete()
      }

      largestContour = contour.clone()
      largestArea = area
    }

    contour.delete()
  }

  src.delete()
  gray.delete()
  binary.delete()
  contours.delete()
  hierarchy.delete()

  return largestContour
}


async function compareSilhouettes() {
  if (!opencvReady.value) {
    compareError.value = 'OpenCV 還在載入中'
    return
  }

  if (!silhouetteImage.value) {
    compareError.value = '請先拍攝並產生剪影'
    return
  }

  isComparing.value = true
  compareError.value = ''
  similarityScore.value = null

  let questionContour = null
  let studentContour = null

  try {

    // 題目的生肖剪影
    const questionImage = await loadImage(
      shuffledAnimals.value[currentIndex.value].image
    )

    // 學生的黑色剪影
    const studentImage = await loadImage(
      silhouetteImage.value
    )

    questionContour =
      getLargestContour(questionImage)

    studentContour =
      getLargestContour(studentImage)

    if (!questionContour || !studentContour) {
      throw new Error('找不到可比較的剪影輪廓')
    }

    /*
      matchShapes：
      數值越小 → 形狀越相似
    */
    const difference = cv.matchShapes(
      questionContour,
      studentContour,
      cv.CONTOURS_MATCH_I1,
      0
    )

    console.log('輪廓差異值：', difference)

    /*
      把差異值轉成比較適合遊戲看的百分比。

      這不是 OpenCV 官方的百分比，
      是我們自己做的遊戲回饋公式。
    */
    let similarity =
      100 / (1 + difference * 5)

    similarity =
      Math.max(
        0,
        Math.min(100, similarity)
      )

    similarityScore.value =
      Math.round(similarity)

  } catch (error) {

    console.error(error)

    compareError.value =
      '目前無法比較剪影，請再拍一次。'

  } finally {

    if (questionContour) {
      questionContour.delete()
    }

    if (studentContour) {
      studentContour.delete()
    }

    isComparing.value = false
  }
}

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

async function initImageSegmenter() {
  try {
    segmenterError.value = ''

    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    )

    imageSegmenter = await ImageSegmenter.createFromOptions(
      vision,
      {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite'
        },

        runningMode: 'IMAGE',

        outputConfidenceMasks: true,
        outputCategoryMask: false
      }
    )

    segmenterReady.value = true

    console.log('MediaPipe 人物分割模型載入完成')
  } catch (error) {
    console.error(error)

    segmenterError.value =
      '人物辨識模型載入失敗，請重新整理頁面再試一次。'
  }
}

function createBlackSilhouette(sourceCanvas) {
  return new Promise((resolve, reject) => {

    if (!imageSegmenter) {
      reject(new Error('Image Segmenter 尚未載入'))
      return
    }

    isProcessingSilhouette.value = true
    segmenterError.value = ''

    try {

      imageSegmenter.segment(
        sourceCanvas,

        (result) => {

          try {

            const mask = result.confidenceMasks?.[0]

            if (!mask) {
              throw new Error('沒有取得人物遮罩')
            }

            const maskData = mask.getAsFloat32Array()

            const width = mask.width
            const height = mask.height

            const outputCanvas =
              document.createElement('canvas')

            outputCanvas.width = width
            outputCanvas.height = height

            const ctx =
              outputCanvas.getContext('2d')

            const imageData =
              ctx.createImageData(width, height)

            /*
              MediaPipe 的值：
              越接近 1 = 越可能是人物
              越接近 0 = 越可能是背景

              我們設定：
              人物 → 黑色
              背景 → 白色
            */

            for (let i = 0; i < maskData.length; i++) {

              const isPerson =
                maskData[i] > 0.5

              const color =
                isPerson ? 0 : 255

              const pixelIndex = i * 4

              imageData.data[pixelIndex] = color
              imageData.data[pixelIndex + 1] = color
              imageData.data[pixelIndex + 2] = color
              imageData.data[pixelIndex + 3] = 255
            }

            ctx.putImageData(
              imageData,
              0,
              0
            )

            silhouetteImage.value =
              outputCanvas.toDataURL('image/png')

            resolve()

          } catch (error) {

            reject(error)

          } finally {

            isProcessingSilhouette.value = false

            if (result.confidenceMasks) {
              result.confidenceMasks.forEach(mask => {
                if (mask.close) {
                  mask.close()
                }
              })
            }
          }
        }
      )

    } catch (error) {

      isProcessingSilhouette.value = false

      reject(error)
    }
  })
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

async function capturePhoto() {
  const video = videoRef.value
  const canvas = canvasRef.value

  if (!video || !canvas) return

  if (!segmenterReady.value) {
    segmenterError.value =
      '人物辨識模型還在載入中，請稍等一下。'

    return
  }

  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  const ctx = canvas.getContext('2d')

  ctx.save()

  // 攝影機是鏡像，所以照片也保持鏡像
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

  // 保存原始照片
  capturedImage.value =
    canvas.toDataURL('image/png')

  silhouetteImage.value = ''

  try {

    // 產生黑色剪影
    await createBlackSilhouette(canvas)

  } catch (error) {

    console.error(error)

    segmenterError.value =
      '無法產生人物剪影，請再拍一次。'
  }
}

function retakePhoto() {
  capturedImage.value = ''
  silhouetteImage.value = ''
  isCompleted.value = false
  segmenterError.value = ''
  similarityScore.value = null
　compareError.value = ''
}

async function completeChallenge() {
  if (!capturedImage.value) return
  if (!silhouetteImage.value) return

  isCompleted.value = true

  await compareSilhouettes()
}

onMounted(() => {
  startCamera()
  initImageSegmenter()
  waitForOpenCV()
})

onBeforeUnmount(() => {
  stopCamera()

  if (imageSegmenter) {
    imageSegmenter.close()
  }
})


function nextQuestion() {
  capturedImage.value = ''
  silhouetteImage.value = ''
  isCompleted.value = false

  similarityScore.value = null
　compareError.value = ''
  currentIndex.value++

  if (currentIndex.value >= shuffledAnimals.value.length) {
    currentIndex.value = 0
  }
}

function previousQuestion() {
  capturedImage.value = ''
  silhouetteImage.value = ''
  isCompleted.value = false

  similarityScore.value = null
　compareError.value = ''
  currentIndex.value--

  if (currentIndex.value < 0) {
    currentIndex.value = shuffledAnimals.value.length - 1
  }
}
shuffleAnimals()
</script>

<template>
  <div class="game-container">

    <!-- 回首頁 -->
    <router-link
      to="/"
      class="back-home"
    >
      ← 回到模式選擇
    </router-link>


    <!-- 標題 -->
    <h1>🐾 十二生肖影子大挑戰</h1>

    <p class="instruction">
      看看左邊的影子，用你的手或身體模仿牠吧！
    </p>


    <!-- 左右主要區域 -->
    <div class="game-area">

      <!-- 左邊：題目 -->
      <div class="panel">

        <h2>
          {{ isCompleted ? '題目答案' : '題目' }}
        </h2>

        <div class="shadow-box">

          <img
            v-if="shuffledAnimals.length > 0"
            :src="shuffledAnimals[currentIndex].image"
            class="animal-image"
          >

        </div>

        <!-- 完成後才公布文字答案 -->
        <div
          v-if="isCompleted && shuffledAnimals.length > 0"
          class="answer-text"
        >
          {{ shuffledAnimals[currentIndex].name }}
        </div>

      </div>


      <!-- 右邊：攝影機 / 學生剪影 -->
      <div class="panel">

        <h2>
          {{ isCompleted ? '我的模仿' : '換你來挑戰！' }}
        </h2>

        <div class="camera-box">

          <!-- 尚未拍照：顯示即時攝影機 -->
          <video
            v-show="!capturedImage"
            ref="videoRef"
            class="camera-video"
            autoplay
            playsinline
            muted
          ></video>


          <!-- 拍照後：顯示黑色剪影 -->
          <img
            v-if="capturedImage"
            :src="silhouetteImage || capturedImage"
            class="captured-image"
          >


          <!-- MediaPipe 正在處理 -->
          <div
            v-if="isProcessingSilhouette"
            class="processing-overlay"
          >
            ✨ 正在製作你的影子...
          </div>


          <!-- MediaPipe 錯誤 -->
          <p
            v-if="segmenterError"
            class="segmenter-error"
          >
            {{ segmenterError }}
          </p>


          <!-- 攝影機錯誤 -->
          <p
            v-if="cameraError"
            class="camera-error"
          >
            {{ cameraError }}
          </p>

        </div>


        <!-- 拍照操作按鈕 -->
        <div
          v-if="!isCompleted"
          class="camera-buttons"
        >

          <!-- 還沒拍照 -->
          <button
            v-if="!capturedImage"
            @click="capturePhoto"
            class="capture-button"
          >
            📸 拍下我的影子
          </button>


          <!-- 已拍照 -->
          <template v-else>

            <button
              @click="retakePhoto"
              class="retake-button"
            >
              🔄 再拍一次
            </button>

            <button
              @click="completeChallenge"
              class="complete-button"
              :disabled="!silhouetteImage || isProcessingSilhouette"
            >
              {{
                isProcessingSilhouette
                  ? '影子製作中...'
                  : '✅ 完成'
              }}
            </button>

          </template>

        </div>


        <!-- 拍照用隱藏 Canvas -->
        <canvas
          ref="canvasRef"
          class="hidden-canvas"
        ></canvas>

      </div>

    </div>


    <!-- OpenCV 相似度結果 -->
    <div
      v-if="isCompleted"
      class="result-area"
    >

      <!-- 計算中 -->
      <div
        v-if="isComparing"
        class="comparing-text"
      >
        🔍 正在比較兩個影子...
      </div>


      <!-- 計算完成 -->
      <div
        v-else-if="similarityScore !== null"
        class="similarity-result"
      >

        <div class="result-title">
          🎯 剪影相似度
        </div>

        <div class="score">
          {{ similarityScore }}%
        </div>

      </div>


      <!-- 比較錯誤 -->
      <p
        v-if="compareError"
        class="compare-error"
      >
        {{ compareError }}
      </p>

    </div>


    <!-- 上一題 / 下一題 -->
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

  display: flex;
  justify-content: center;
  gap: 15px;
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

.answer-text {
  margin-top: 15px;
  font-size: 42px;
  font-weight: bold;
}

.complete-button {
  background-color: #8fd694;
}

.back-home {
  display: block;
  width: fit-content;

  margin-bottom: 10px;

  font-size: 18px;
  font-weight: bold;

  color: #333;
  text-decoration: none;
}

.back-home:hover {
  text-decoration: underline;
}

.processing-overlay {
  position: absolute;

  padding: 14px 22px;

  background-color: rgba(255, 255, 255, 0.9);

  border-radius: 12px;

  font-size: 20px;
  font-weight: bold;
}

.segmenter-error {
  margin-top: 10px;

  color: #c0392b;

  font-size: 16px;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.result-area {
  margin-top: 25px;
  text-align: center;
}

.comparing-text {
  font-size: 22px;
  font-weight: bold;
}

.similarity-result {
  display: inline-block;

  padding: 18px 35px;

  background-color: white;

  border-radius: 18px;

  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.result-title {
  font-size: 22px;
  font-weight: bold;
}

.score {
  margin-top: 5px;

  font-size: 52px;
  font-weight: bold;
}

.compare-error {
  color: #c0392b;
  font-size: 18px;
}

</style>