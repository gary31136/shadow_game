<template>
  <div class="page">

    <router-link to="/" class="back">
      ← 回到模式選擇
    </router-link>

    <h1>🤖 AI 猜猜我是誰</h1>

    <p>
      AI 圖片辨識功能即將加入！
    </p>

  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 40px;
  text-align: center;
  background-color: #fff8e7;
}

.back {
  display: block;
  text-align: left;

  font-size: 20px;
  text-decoration: none;
  color: #333;
}

h1 {
  margin-top: 80px;
  font-size: 40px;
}

p {
  font-size: 24px;
}
</style>