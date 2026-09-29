<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import {
  FilesetResolver,
  ImageSegmenter
} from '@mediapipe/tasks-vision'


/* =========================
   十二生肖資料
========================= */

const base = import.meta.env.BASE_URL

const animals = [
  { name: '鼠', image: base + 'images/rat.png' },
  { name: '牛', image: base + 'images/ox.png' },
  { name: '虎', image: base + 'images/tiger.png' },
  { name: '兔', image: base + 'images/rabbit.png' },
  { name: '龍', image: base + 'images/dragon.png' },
  { name: '蛇', image: base + 'images/snake.png' },
  { name: '馬', image: base + 'images/horse.png' },
  { name: '羊', image: base + 'images/goat.png' },
  { name: '猴', image: base + 'images/monkey.png' },
  { name: '雞', image: base + 'images/rooster.png' },
  { name: '狗', image: base + 'images/dog.png' },
  { name: '豬', image: base + 'images/pig.png' }
]


/* =========================
   題目狀態
========================= */

const shuffledAnimals = ref([])
const currentIndex = ref(0)

function shuffleAnimals() {
  shuffledAnimals.value = [...animals]

  for (
    let i = shuffledAnimals.value.length - 1;
    i > 0;
    i--
  ) {
    const j = Math.floor(Math.random() * (i + 1))

    const temp = shuffledAnimals.value[i]
    shuffledAnimals.value[i] =
      shuffledAnimals.value[j]

    shuffledAnimals.value[j] = temp
  }

  currentIndex.value = 0
}


/* =========================
   攝影機
========================= */

const videoRef = ref(null)
const canvasRef = ref(null)

const cameraError = ref('')

let mediaStream = null


async function startCamera() {
  try {
    cameraError.value = ''

    mediaStream =
      await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      })

    if (videoRef.value) {
      videoRef.value.srcObject = mediaStream
    }

  } catch (error) {
    console.error(error)

    cameraError.value =
      '無法開啟攝影機，請確認已允許攝影機權限。'
  }
}


function stopCamera() {
  if (mediaStream) {
    mediaStream
      .getTracks()
      .forEach(track => track.stop())

    mediaStream = null
  }
}


/* =========================
   拍照與完成狀態
========================= */

const capturedImage = ref('')
const silhouetteImage = ref('')
const isCompleted = ref(false)

const similarityScore = ref(null)
const isComparing = ref(false)
const compareError = ref('')


/* =========================
   MediaPipe
========================= */

const segmenterReady = ref(false)
const isProcessingSilhouette = ref(false)
const segmenterError = ref('')

let imageSegmenter = null


async function initImageSegmenter() {
  try {
    segmenterError.value = ''

    const vision =
      await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      )

    imageSegmenter =
      await ImageSegmenter.createFromOptions(
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

    console.log(
      'MediaPipe 人物分割模型載入完成'
    )

  } catch (error) {
    console.error(error)

    segmenterError.value =
      '人物辨識模型載入失敗，請重新整理頁面。'
  }
}


function createBlackSilhouette(sourceCanvas) {
  return new Promise((resolve, reject) => {

    if (!imageSegmenter) {
      reject(
        new Error(
          'Image Segmenter 尚未載入'
        )
      )

      return
    }

    isProcessingSilhouette.value = true
    segmenterError.value = ''

    try {

      imageSegmenter.segment(
        sourceCanvas,

        result => {

          try {

            const mask =
              result.confidenceMasks?.[0]

            if (!mask) {
              throw new Error(
                '沒有取得人物遮罩'
              )
            }

            const maskData =
              mask.getAsFloat32Array()

            const width = mask.width
            const height = mask.height

            const outputCanvas =
              document.createElement('canvas')

            outputCanvas.width = width
            outputCanvas.height = height

            const ctx =
              outputCanvas.getContext('2d')

            const imageData =
              ctx.createImageData(
                width,
                height
              )

            for (
              let i = 0;
              i < maskData.length;
              i++
            ) {

              const isPerson =
                maskData[i] > 0.5

              const color =
                isPerson ? 0 : 255

              const pixelIndex = i * 4

              imageData.data[pixelIndex] =
                color

              imageData.data[
                pixelIndex + 1
              ] = color

              imageData.data[
                pixelIndex + 2
              ] = color

              imageData.data[
                pixelIndex + 3
              ] = 255
            }

            ctx.putImageData(
              imageData,
              0,
              0
            )

            silhouetteImage.value =
              outputCanvas.toDataURL(
                'image/png'
              )

            resolve()

          } catch (error) {

            reject(error)

          } finally {

            isProcessingSilhouette.value =
              false

            if (
              result.confidenceMasks
            ) {
              result.confidenceMasks
                .forEach(mask => {
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

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()

    img.onload = () => resolve(img)

    img.onerror = () => {
      reject(new Error('圖片載入失敗'))
    }

    img.src = src
  })
}


function createNormalizedMask(img, size = 256) {

  /*
    第一步：
    先把圖片畫進暫存 Canvas
  */

  const sourceCanvas =
    document.createElement('canvas')

  sourceCanvas.width = img.naturalWidth || img.width
  sourceCanvas.height = img.naturalHeight || img.height

  const sourceCtx =
    sourceCanvas.getContext('2d')

  sourceCtx.drawImage(
    img,
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height
  )


  const sourceData =
    sourceCtx.getImageData(
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height
    )


  /*
    第二步：
    找出黑色剪影的範圍
  */

  let minX = sourceCanvas.width
  let minY = sourceCanvas.height

  let maxX = -1
  let maxY = -1


  for (
    let y = 0;
    y < sourceCanvas.height;
    y++
  ) {

    for (
      let x = 0;
      x < sourceCanvas.width;
      x++
    ) {

      const index =
        (y * sourceCanvas.width + x) * 4

      const r = sourceData.data[index]
      const g = sourceData.data[index + 1]
      const b = sourceData.data[index + 2]

      /*
        RGB 平均小於 160
        就視為黑色剪影
      */

      const brightness =
        (r + g + b) / 3

      if (brightness < 160) {

        if (x < minX) minX = x
        if (x > maxX) maxX = x

        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }


  if (
    maxX === -1 ||
    maxY === -1
  ) {
    throw new Error('找不到剪影')
  }


  /*
    第三步：
    把剪影裁切後放進統一的 256×256
  */

  const objectWidth =
    maxX - minX + 1

  const objectHeight =
    maxY - minY + 1


  const normalizedCanvas =
    document.createElement('canvas')

  normalizedCanvas.width = size
  normalizedCanvas.height = size


  const ctx =
    normalizedCanvas.getContext('2d')


  /*
    先全部畫白色
  */

  ctx.fillStyle = 'white'

  ctx.fillRect(
    0,
    0,
    size,
    size
  )


  /*
    四周留一些空白
  */

  const padding = 20

  const availableSize =
    size - padding * 2


  /*
    等比例縮放
  */

  const scale =
    Math.min(
      availableSize / objectWidth,
      availableSize / objectHeight
    )


  const drawWidth =
    objectWidth * scale

  const drawHeight =
    objectHeight * scale


  /*
    放到畫面中央
  */

  const drawX =
    (size - drawWidth) / 2

  const drawY =
    (size - drawHeight) / 2


  ctx.drawImage(
    sourceCanvas,

    minX,
    minY,
    objectWidth,
    objectHeight,

    drawX,
    drawY,
    drawWidth,
    drawHeight
  )


  /*
    第四步：
    把圖片轉成只有 0 / 1 的遮罩
  */

  const normalizedData =
    ctx.getImageData(
      0,
      0,
      size,
      size
    )


  const mask =
    new Uint8Array(
      size * size
    )


  for (
    let i = 0;
    i < mask.length;
    i++
  ) {

    const index = i * 4

    const r =
      normalizedData.data[index]

    const g =
      normalizedData.data[index + 1]

    const b =
      normalizedData.data[index + 2]


    const brightness =
      (r + g + b) / 3


    mask[i] =
      brightness < 160 ? 1 : 0
  }


  return {
    mask,
    size
  }
}


function flipMaskHorizontally(mask, size) {

  const flipped =
    new Uint8Array(
      mask.length
    )


  for (
    let y = 0;
    y < size;
    y++
  ) {

    for (
      let x = 0;
      x < size;
      x++
    ) {

      const sourceIndex =
        y * size + x

      const targetIndex =
        y * size +
        (size - 1 - x)


      flipped[targetIndex] =
        mask[sourceIndex]
    }
  }


  return flipped
}


function calculateDiceSimilarity(
  maskA,
  maskB
) {

  let intersection = 0

  let areaA = 0
  let areaB = 0


  for (
    let i = 0;
    i < maskA.length;
    i++
  ) {

    if (maskA[i]) {
      areaA++
    }

    if (maskB[i]) {
      areaB++
    }

    if (
      maskA[i] &&
      maskB[i]
    ) {
      intersection++
    }
  }


  if (
    areaA + areaB === 0
  ) {
    return 0
  }


  /*
    Dice Similarity

    1 = 完全一樣
    0 = 完全沒有重疊
  */

  return (
    2 * intersection /
    (areaA + areaB)
  )
}


async function compareSilhouettes() {

  if (!silhouetteImage.value) {

    compareError.value =
      '請先拍照產生剪影'

    return
  }


  if (
    shuffledAnimals.value.length === 0
  ) {
    return
  }


  isComparing.value = true

  compareError.value = ''

  similarityScore.value = null


  try {

    /*
      取得目前的題目圖片
    */

    const questionSrc =
      shuffledAnimals.value[
        currentIndex.value
      ].image


    /*
      載入兩張圖片
    */

    const questionImage =
      await loadImageElement(
        questionSrc
      )


    const studentImage =
      await loadImageElement(
        silhouetteImage.value
      )


    /*
      統一尺寸、裁掉空白
    */

    const question =
      createNormalizedMask(
        questionImage
      )


    const student =
      createNormalizedMask(
        studentImage
      )


    /*
      正常方向比較一次
    */

    const normalScore =
      calculateDiceSimilarity(
        question.mask,
        student.mask
      )


    /*
      學生剪影左右翻轉後
      再比較一次
    */

    const flippedStudentMask =
      flipMaskHorizontally(
        student.mask,
        student.size
      )


    const flippedScore =
      calculateDiceSimilarity(
        question.mask,
        flippedStudentMask
      )


    /*
      取比較高的那一個

      這樣學生朝左、朝右
      都不會受到太大影響
    */

    const bestScore =
      Math.max(
        normalScore,
        flippedScore
      )


    /*
      轉成百分比
    */

    similarityScore.value =
      Math.round(
        bestScore * 100
      )


    console.log(
      '正常方向：',
      Math.round(
        normalScore * 100
      ) + '%'
    )

    console.log(
      '鏡像方向：',
      Math.round(
        flippedScore * 100
      ) + '%'
    )

    console.log(
      '最後相似度：',
      similarityScore.value + '%'
    )


  } catch (error) {

    console.error(error)

    compareError.value =
      '剪影比較失敗，請再試一次。'

  } finally {

    isComparing.value = false
  }
}

/* =========================
   拍照
========================= */

async function capturePhoto() {

  const video = videoRef.value
  const canvas = canvasRef.value

  if (!video || !canvas) return


  if (!segmenterReady.value) {

    segmenterError.value =
      '人物辨識模型還在載入中，請稍等一下。'

    return
  }


  canvas.width =
    video.videoWidth

  canvas.height =
    video.videoHeight


  const ctx =
    canvas.getContext('2d')


  ctx.save()

  /* 鏡像 */
  ctx.translate(
    canvas.width,
    0
  )

  ctx.scale(
    -1,
    1
  )

  ctx.drawImage(
    video,
    0,
    0,
    canvas.width,
    canvas.height
  )

  ctx.restore()


  capturedImage.value =
    canvas.toDataURL('image/png')

  silhouetteImage.value = ''


  try {

    await createBlackSilhouette(
      canvas
    )

  } catch (error) {

    console.error(error)

    segmenterError.value =
      '無法產生人物剪影，請再拍一次。'
  }
}


/* =========================
   再拍一次 / 完成
========================= */

function retakePhoto() {

  capturedImage.value = ''
  silhouetteImage.value = ''

  isCompleted.value = false

  segmenterError.value = ''
}


async function completeChallenge() {

  if (!capturedImage.value) return

  if (!silhouetteImage.value) return


  isCompleted.value = true


  await compareSilhouettes()
}


/* =========================
   上一題 / 下一題
========================= */

function nextQuestion() {

  capturedImage.value = ''
  silhouetteImage.value = ''

  isCompleted.value = false
  segmenterError.value = ''

  currentIndex.value++

  if (
    currentIndex.value >=
    shuffledAnimals.value.length
  ) {
    currentIndex.value = 0
  }
}


function previousQuestion() {

  capturedImage.value = ''
  silhouetteImage.value = ''

  isCompleted.value = false
  segmenterError.value = ''

  currentIndex.value--

  if (currentIndex.value < 0) {
    currentIndex.value =
      shuffledAnimals.value.length - 1
  }
}


/* =========================
   啟動
========================= */

onMounted(() => {

  shuffleAnimals()

  startCamera()

  initImageSegmenter()
})


onBeforeUnmount(() => {

  stopCamera()

  if (imageSegmenter) {
    imageSegmenter.close()
  }
})
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


    <h1>
      🐾 十二生肖影子大挑戰
    </h1>


    <p class="instruction">
      看看左邊的影子，用你的手或身體模仿牠吧！
    </p>


    <div class="game-area">


      <!-- ==================
           左邊：題目
      =================== -->

      <div class="panel">

        <h2>
          {{
            isCompleted
              ? '題目答案'
              : '題目'
          }}
        </h2>


        <div class="shadow-box">

          <img
            v-if="
              shuffledAnimals.length > 0
            "
            :src="
              shuffledAnimals[
                currentIndex
              ].image
            "
            class="animal-image"
          >

        </div>


        <div
          v-if="
            isCompleted &&
            shuffledAnimals.length > 0
          "
          class="answer-text"
        >
          {{
            shuffledAnimals[
              currentIndex
            ].name
          }}
        </div>

      </div>



      <!-- ==================
           右邊：學生
      =================== -->

      <div class="panel">

        <h2>
          {{
            isCompleted
              ? '我的模仿'
              : '換你來挑戰！'
          }}
        </h2>


        <div class="camera-box">


          <!-- 即時攝影機 -->
          <video
            v-show="!capturedImage"
            ref="videoRef"
            class="camera-video"
            autoplay
            playsinline
            muted
          ></video>


          <!-- 拍照後顯示剪影 -->
          <img
            v-if="capturedImage"
            :src="
              silhouetteImage ||
              capturedImage
            "
            class="captured-image"
          >


          <!-- 處理中 -->
          <div
            v-if="
              isProcessingSilhouette
            "
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



        <!-- 操作按鈕 -->

        <div
          v-if="!isCompleted"
          class="camera-buttons"
        >


          <!-- 尚未拍照 -->

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
              @click="
                completeChallenge
              "
              class="complete-button"
              :disabled="
                !silhouetteImage ||
                isProcessingSilhouette
              "
            >
              ✅ 完成
            </button>

          </template>

        </div>



        <!-- 隱藏的 Canvas -->

        <canvas
          ref="canvasRef"
          class="hidden-canvas"
        ></canvas>

      </div>

    </div>

<!-- 相似度結果 -->
<div
  v-if="isCompleted"
  class="result-area"
>

  <div
    v-if="isComparing"
    class="comparing-text"
  >
    🔍 正在比較兩個影子...
  </div>

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

    <div class="result-message">
      {{
        similarityScore >= 80
          ? '太厲害了！非常接近！'
          : similarityScore >= 60
            ? '很不錯，再調整一下會更像！'
            : similarityScore >= 40
              ? '已經有抓到形狀了，再試試看！'
              : '再觀察一下剪影的輪廓喔！'
      }}
    </div>
  </div>

  <p
    v-if="compareError"
    class="compare-error"
  >
    {{ compareError }}
  </p>

</div>


    <!-- ==================
         上一題 / 下一題
    =================== -->

    <div class="buttons">

      <button
        @click="previousQuestion"
      >
        ← 上一題
      </button>


      <div class="question-number">
        {{ currentIndex + 1 }}
        /
        {{ shuffledAnimals.length }}
      </div>


      <button
        @click="nextQuestion"
      >
        下一題 →
      </button>

    </div>


  </div>

</template>


<style scoped>

.game-container {
  min-height: 100vh;
  box-sizing: border-box;

  padding: 30px;

  text-align: center;

  background-color: #fff8e7;
}


/* 返回首頁 */

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


/* 標題 */

h1 {
  font-size: 40px;

  margin-top: 10px;
  margin-bottom: 10px;
}

.instruction {
  font-size: 22px;

  margin-bottom: 30px;
}


/* 左右區塊 */

.game-area {
  width: 90%;
  max-width: 1200px;

  margin: auto;

  display: flex;

  justify-content: center;
  align-items: stretch;

  gap: 30px;
}


/* 卡片 */

.panel {
  flex: 1;

  min-width: 0;

  background-color: white;

  padding: 25px;

  border-radius: 20px;

  box-shadow:
    0 4px 15px
    rgba(0, 0, 0, 0.12);
}

.panel h2 {
  font-size: 26px;

  margin-top: 0;
}


/* 題目 */

.shadow-box {
  width: 100%;
  height: 420px;

  display: flex;

  justify-content: center;
  align-items: center;

  background-color: white;

  border-radius: 15px;

  overflow: hidden;
}

.animal-image {
  width: 90%;
  height: 90%;

  object-fit: contain;
}

.answer-text {
  margin-top: 15px;

  font-size: 42px;
  font-weight: bold;
}


/* 攝影機 */

.camera-box {
  width: 100%;
  height: 420px;

  position: relative;

  display: flex;

  justify-content: center;
  align-items: center;

  box-sizing: border-box;

  background-color: #eeeeee;

  border: 4px dashed #bbbbbb;

  border-radius: 15px;

  overflow: hidden;
}

.camera-video {
  width: 100%;
  height: 100%;

  object-fit: cover;

  border-radius: 12px;

  transform: scaleX(-1);
}

.captured-image {
  width: 100%;
  height: 100%;

  object-fit: contain;

  background-color: white;

  border-radius: 12px;
}


/* 拍照按鈕 */

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

.complete-button {
  background-color: #8fd694;
}


/* 下方導航 */

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

button:hover:not(:disabled) {
  transform: scale(1.05);
}

button:disabled {
  opacity: 0.5;

  cursor: not-allowed;
}

.question-number {
  font-size: 20px;
  font-weight: bold;
}


/* MediaPipe */

.processing-overlay {
  position: absolute;

  z-index: 5;

  padding: 14px 22px;

  background-color:
    rgba(255, 255, 255, 0.92);

  border-radius: 12px;

  font-size: 20px;
  font-weight: bold;

  pointer-events: none;
}

.segmenter-error,
.camera-error {
  position: absolute;

  z-index: 6;

  bottom: 10px;

  width: 85%;

  padding: 8px;

  background-color:
    rgba(255, 255, 255, 0.9);

  color: #c0392b;

  border-radius: 8px;

  font-size: 16px;

  pointer-events: none;
}


/* 隱藏 Canvas */

.hidden-canvas {
  display: none;
}


/* 小螢幕 */

@media (max-width: 800px) {

  .game-area {
    flex-direction: column;
  }

  .shadow-box,
  .camera-box {
    height: 320px;
  }

  h1 {
    font-size: 32px;
  }
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

  min-width: 220px;

  padding: 18px 30px;

  background-color: white;

  border-radius: 18px;

  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.12);
}

.result-title {
  font-size: 22px;
  font-weight: bold;
}

.score {
  margin-top: 6px;

  font-size: 54px;
  font-weight: bold;
}

.result-message {
  margin-top: 8px;

  font-size: 18px;
  line-height: 1.5;
}

.compare-error {
  color: #c0392b;
  font-size: 18px;
}


</style>