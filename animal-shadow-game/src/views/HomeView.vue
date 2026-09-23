<template>
  <div class="home">

    <h1>🐾 十二生肖影子大挑戰</h1>

    <p class="subtitle">
      請選擇今天要進行的挑戰模式
    </p>

    <div class="mode-area">

      <router-link
        to="/shape-match"
        class="mode-card"
      >
        <div class="icon">🎯</div>

        <h2>剪影相似度挑戰</h2>

        <p>
          模仿題目的生肖剪影，
          看看你的影子和題目有多像！
        </p>

        <div class="start-button">
          開始挑戰 →
        </div>
      </router-link>


      <router-link
        to="/ai-recognition"
        class="mode-card"
      >
        <div class="icon">🤖</div>

        <h2>AI 猜猜我是誰</h2>

        <p>
          用身體模仿生肖，
          看看 AI 能不能猜出你是誰！
        </p>

        <div class="start-button">
          開始挑戰 →
        </div>
      </router-link>

    </div>

  </div>
</template>

<style scoped>
.home {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 50px 30px;
  text-align: center;
  background-color: #fff8e7;
}

h1 {
  font-size: 42px;
  margin-bottom: 10px;
}

.subtitle {
  font-size: 22px;
  margin-bottom: 45px;
}

.mode-area {
  max-width: 1000px;
  margin: auto;

  display: flex;
  justify-content: center;
  gap: 35px;
}

.mode-card {
  flex: 1;

  padding: 35px 30px;

  background-color: white;

  border-radius: 24px;

  box-shadow: 0 5px 18px rgba(0, 0, 0, 0.12);

  text-decoration: none;
  color: #222;

  transition: 0.2s;

  display: flex;
  flex-direction: column;
  align-items: center;
}

.mode-card:hover {
  transform: translateY(-6px);
}

.icon {
  font-size: 70px;
  line-height: 1;
  margin-bottom: 24px;
}

.mode-card h2 {
  font-size: 28px;
  margin-top: 0;
  margin-bottom: 16px;
}

.mode-card p {
  font-size: 20px;
  line-height: 1.7;
}

.start-button {
  display: inline-block;

  margin-top: 20px;

  padding: 14px 28px;

  background-color: #ffd966;

  border-radius: 14px;

  font-size: 20px;
  font-weight: bold;
}

@media (max-width: 800px) {
  .mode-area {
    flex-direction: column;
  }
}
</style>