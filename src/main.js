/* global Phaser */

const GAME_TITLE = "Lumen Reef Drift";
const STORAGE_KEY = "lumen-reef-best-score";

class TinySynth {
  constructor() {
    this.context = null;
    this.master = null;
    this.musicTimer = null;
    this.step = 0;
    this.isStarted = false;
    this.scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 659.25];
  }

  start() {
    if (this.isStarted) {
      return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      return;
    }

    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0.18;
    this.master.connect(this.context.destination);
    this.isStarted = true;
    this.startMusic();
  }

  resume() {
    if (this.context && this.context.state === "suspended") {
      this.context.resume();
    }
  }

  startMusic() {
    if (this.musicTimer || !this.context) {
      return;
    }

    this.musicTimer = window.setInterval(() => {
      const note = this.scale[this.step % this.scale.length];
      const octave = this.step % 8 === 7 ? 0.5 : 1;
      const time = this.context.currentTime;

      this.playTone(note * octave, 0.16, "sine", 0.035, time);
      if (this.step % 4 === 0) {
        this.playTone(note * 0.5, 0.42, "triangle", 0.025, time);
      }

      this.step += 1;
    }, 260);
  }

  playTone(frequency, duration, type = "sine", volume = 0.06, startTime = null) {
    if (!this.context || !this.master) {
      return;
    }

    const now = startTime || this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.04);
  }

  collect() {
    this.resume();
    this.playTone(660, 0.09, "sine", 0.08);
    this.playTone(990, 0.16, "triangle", 0.04, this.context?.currentTime + 0.05);
  }

  hurt() {
    this.resume();
    this.playTone(110, 0.18, "sawtooth", 0.08);
    this.playTone(82, 0.28, "triangle", 0.06, this.context?.currentTime + 0.05);
  }

  dash() {
    this.resume();
    this.playTone(220, 0.06, "triangle", 0.06);
    this.playTone(880, 0.16, "sine", 0.05, this.context?.currentTime + 0.03);
  }

  gameOver() {
    this.resume();
    this.playTone(392, 0.12, "sine", 0.05);
    this.playTone(261.63, 0.28, "triangle", 0.05, this.context?.currentTime + 0.12);
  }
}

class LumenReefScene extends Phaser.Scene {
  constructor() {
    super("LumenReefScene");
    this.synth = new TinySynth();
  }

  create() {
    this.width = this.scale.width;
    this.height = this.scale.height;
    this.center = new Phaser.Math.Vector2(this.width * 0.32, this.height * 0.5);
    this.pointerTarget = this.center.clone();
    this.keys = this.input.keyboard.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,ENTER");
    this.nectar = [];
    this.shards = [];
    this.reef = [];
    this.score = 0;
    this.combo = 1;
    this.lives = 3;
    this.elapsed = 0;
    this.difficulty = 1;
    this.lastCollectAt = 0;
    this.nextNectarAt = 450;
    this.nextShardAt = 900;
    this.nextCoralAt = 300;
    this.isPlaying = false;
    this.isGameOver = false;
    this.isDashing = false;
    this.canDash = true;
    this.invulnerableUntil = 0;
    this.bestScore = this.loadBestScore();

    this.createTextures();
    this.createWorld();
    this.createPlayer();
    this.createHud();
    this.bindInputs();
    this.showStartMessage();
  }

  createTextures() {
    this.createRadialTexture("nectar", 72, "#fbfff2", "#66ffe6", "rgba(80, 255, 225, 0)");
    this.createRadialTexture("glow", 96, "#ffffff", "#ff7bd8", "rgba(255, 123, 216, 0)");
    this.createRadialTexture("spark", 20, "#ffffff", "#71fff3", "rgba(113, 255, 243, 0)");
    this.createRadialTexture("dust", 14, "#fff6b7", "#c290ff", "rgba(194, 144, 255, 0)");
    this.createMothTexture();
    this.createShardTexture();
    this.createCoralTexture();
    this.createBackdropTexture();
  }

  createRadialTexture(key, size, innerColor, midColor, outerColor) {
    const texture = this.textures.createCanvas(key, size, size);
    const canvas = texture.getSourceImage();
    const ctx = canvas.getContext("2d");
    const radius = size / 2;
    const gradient = ctx.createRadialGradient(radius, radius, 1, radius, radius, radius);

    gradient.addColorStop(0, innerColor);
    gradient.addColorStop(0.38, midColor);
    gradient.addColorStop(1, outerColor);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(radius, radius, radius, 0, Math.PI * 2);
    ctx.fill();
    texture.refresh();
  }

  createMothTexture() {
    const texture = this.textures.createCanvas("moth", 96, 72);
    const canvas = texture.getSourceImage();
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, 96, 72);
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#66ffe6";
    ctx.fillStyle = "rgba(101, 255, 225, 0.22)";
    ctx.beginPath();
    ctx.ellipse(36, 36, 30, 18, -0.35, 0, Math.PI * 2);
    ctx.ellipse(60, 36, 30, 18, 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.58)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(48, 32);
    ctx.quadraticCurveTo(31, 18, 17, 35);
    ctx.moveTo(48, 32);
    ctx.quadraticCurveTo(65, 18, 79, 35);
    ctx.stroke();

    const body = ctx.createLinearGradient(42, 22, 54, 54);
    body.addColorStop(0, "#fff7d6");
    body.addColorStop(0.45, "#65ffe1");
    body.addColorStop(1, "#ff7bd8");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(48, 38, 8, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#fff7d6";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(45, 20);
    ctx.quadraticCurveTo(36, 9, 27, 12);
    ctx.moveTo(51, 20);
    ctx.quadraticCurveTo(60, 9, 69, 12);
    ctx.stroke();
    texture.refresh();
  }

  createShardTexture() {
    const texture = this.textures.createCanvas("shard", 72, 90);
    const canvas = texture.getSourceImage();
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, 72, 90);
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#ff407d";
    const gradient = ctx.createLinearGradient(12, 6, 60, 82);
    gradient.addColorStop(0, "#fff1ff");
    gradient.addColorStop(0.45, "#ff548f");
    gradient.addColorStop(1, "#401139");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(38, 3);
    ctx.lineTo(65, 34);
    ctx.lineTo(48, 86);
    ctx.lineTo(10, 55);
    ctx.lineTo(22, 18);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
    texture.refresh();
  }

  createCoralTexture() {
    const texture = this.textures.createCanvas("coral", 120, 130);
    const canvas = texture.getSourceImage();
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, 120, 130);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#6d5bff";
    ctx.strokeStyle = "rgba(124, 105, 255, 0.52)";
    ctx.lineWidth = 7;

    const branches = [
      [60, 128, 60, 78, 38, 42],
      [60, 96, 85, 62, 100, 28],
      [54, 94, 31, 75, 18, 43],
      [62, 72, 74, 47, 71, 20],
      [48, 72, 46, 46, 58, 24]
    ];

    branches.forEach(([sx, sy, cx, cy, ex, ey]) => {
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(cx, cy, ex, ey);
      ctx.stroke();
    });

    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(101, 255, 225, 0.6)";
    [[38, 42], [100, 28], [18, 43], [71, 20], [58, 24]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    });
    texture.refresh();
  }

  createBackdropTexture() {
    const texture = this.textures.createCanvas("backdrop", 32, 512);
    const canvas = texture.getSourceImage();
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);

    gradient.addColorStop(0, "#19255f");
    gradient.addColorStop(0.42, "#0b133b");
    gradient.addColorStop(1, "#030412");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 512);
    texture.refresh();
  }

  createWorld() {
    this.backdrop = this.add.tileSprite(0, 0, this.width, this.height, "backdrop")
      .setOrigin(0)
      .setScrollFactor(0);

    this.nebula = this.add.particles(0, 0, "dust", {
      x: { min: 0, max: this.width },
      y: { min: 0, max: this.height },
      speedX: { min: -12, max: -2 },
      speedY: { min: -4, max: 4 },
      lifespan: { min: 5000, max: 9000 },
      scale: { start: 0.18, end: 0 },
      alpha: { start: 0.45, end: 0 },
      quantity: 2,
      frequency: 180,
      blendMode: "ADD"
    });
  }

  createPlayer() {
    this.playerGlow = this.add.sprite(this.center.x, this.center.y, "glow")
      .setScale(0.9)
      .setAlpha(0.55)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.player = this.add.sprite(this.center.x, this.center.y, "moth")
      .setScale(0.78);

    this.playerTrail = this.add.particles(0, 0, "spark", {
      lifespan: 520,
      speed: { min: 8, max: 34 },
      scale: { start: 0.32, end: 0 },
      alpha: { start: 0.8, end: 0 },
      quantity: 2,
      frequency: 35,
      blendMode: "ADD",
      follow: this.player,
      followOffset: { x: -24, y: 0 }
    });

    this.tweens.add({
      targets: this.playerGlow,
      scale: 1.16,
      alpha: 0.28,
      duration: 1050,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
  }

  createHud() {
    const font = {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "22px",
      color: "#f7f0ff",
      stroke: "#09112d",
      strokeThickness: 5
    };

    this.scoreText = this.add.text(24, 106, "Score 0", font).setDepth(5);
    this.comboText = this.add.text(24, 136, "Chain x1", { ...font, fontSize: "16px", color: "#65ffe1" }).setDepth(5);
    this.livesText = this.add.text(24, 160, "Lives 3", { ...font, fontSize: "16px", color: "#ffbadf" }).setDepth(5);
    this.bestText = this.add.text(24, 184, `Best ${this.bestScore}`, { ...font, fontSize: "16px", color: "#fff4aa" }).setDepth(5);
    this.messageText = this.add.text(this.width / 2, this.height / 2, "", {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: `${this.getResponsiveTitleSize()}px`,
      color: "#ffffff",
      align: "center",
      stroke: "#08102a",
      strokeThickness: 8
    }).setOrigin(0.5).setDepth(10);
  }

  bindInputs() {
    const startButton = document.getElementById("start-button");
    const instructions = document.getElementById("instructions");

    startButton?.addEventListener("click", () => {
      this.startGame();
      instructions?.classList.add("minimized");
    });

    this.input.on("pointermove", (pointer) => {
      this.pointerTarget.set(pointer.x, pointer.y);
    });

    this.input.on("pointerdown", (pointer) => {
      this.pointerTarget.set(pointer.x, pointer.y);
      if (!this.isPlaying) {
        this.startGame();
        instructions?.classList.add("minimized");
      }

      const now = this.time.now;
      if (now - (this.lastTapAt || 0) < 280) {
        this.tryDash();
      }
      this.lastTapAt = now;
    });

    this.input.keyboard.on("keydown-SPACE", () => {
      if (!this.isPlaying) {
        this.startGame();
      } else {
        this.tryDash();
      }
      instructions?.classList.add("minimized");
    });

    this.input.keyboard.on("keydown-ENTER", () => {
      if (!this.isPlaying) {
        this.startGame();
        instructions?.classList.add("minimized");
      }
    });

    this.scale.on("resize", (gameSize) => {
      this.width = gameSize.width;
      this.height = gameSize.height;
      this.backdrop.setSize(this.width, this.height);
      if (typeof this.nebula.setConfig === "function") {
        this.nebula.setConfig({
          x: { min: 0, max: this.width },
          y: { min: 0, max: this.height }
        });
      }
      this.messageText.setPosition(this.width / 2, this.height / 2);
      this.messageText.setFontSize(this.getResponsiveTitleSize());
      this.pointerTarget.x = Phaser.Math.Clamp(this.pointerTarget.x, 40, this.width - 40);
      this.pointerTarget.y = Phaser.Math.Clamp(this.pointerTarget.y, 40, this.height - 40);
    });
  }

  getResponsiveTitleSize() {
    return Phaser.Math.Clamp(Math.round(this.width * 0.052), 26, 54);
  }

  showStartMessage() {
    this.messageText.setText(`${GAME_TITLE}\nClick, tap, or press Space`);
  }

  startGame() {
    this.synth.start();
    this.synth.resume();

    if (this.isPlaying) {
      return;
    }

    this.clearObjects();
    this.score = 0;
    this.combo = 1;
    this.lives = 3;
    this.elapsed = 0;
    this.difficulty = 1;
    this.lastCollectAt = 0;
    this.nextNectarAt = 220;
    this.nextShardAt = 800;
    this.nextCoralAt = 200;
    this.isPlaying = true;
    this.isGameOver = false;
    this.canDash = true;
    this.isDashing = false;
    this.invulnerableUntil = 0;
    this.player.setPosition(this.width * 0.32, this.height * 0.5).setAlpha(1).setScale(0.78);
    this.playerGlow.setPosition(this.player.x, this.player.y).setAlpha(0.55);
    this.pointerTarget.set(this.player.x, this.player.y);
    this.messageText.setText("");
    this.updateHud();
  }

  clearObjects() {
    [...this.nectar, ...this.shards, ...this.reef].forEach((object) => object.destroy());
    this.nectar = [];
    this.shards = [];
    this.reef = [];
  }

  update(time, delta) {
    const dt = delta / 1000;
    this.backdrop.tilePositionX += 8 * dt;
    this.backdrop.tilePositionY -= 3 * dt;

    if (!this.isPlaying) {
      this.floatPlayer(time, dt);
      return;
    }

    this.elapsed += delta;
    this.difficulty = 1 + Math.min(3.5, this.elapsed / 36000);
    this.score += Math.floor(7 * dt * this.difficulty);
    this.spawnLoop(time);
    this.updatePlayer(dt);
    this.updateObjects(dt);
    this.checkCollisions(time);
    this.updateHud();
  }

  floatPlayer(time, dt) {
    const bob = Math.sin(time * 0.002) * 12;
    const driftX = this.width * 0.32 + Math.cos(time * 0.0013) * 10;
    const driftY = this.height * 0.52 + bob;

    this.player.x = Phaser.Math.Linear(this.player.x, driftX, 3 * dt);
    this.player.y = Phaser.Math.Linear(this.player.y, driftY, 3 * dt);
    this.player.rotation = Math.sin(time * 0.002) * 0.08;
    this.playerGlow.setPosition(this.player.x, this.player.y);
  }

  spawnLoop(time) {
    if (time > this.nextNectarAt) {
      this.spawnNectar();
      this.nextNectarAt = time + Phaser.Math.Between(430, 720) / this.difficulty;
    }

    if (time > this.nextShardAt) {
      this.spawnShard();
      this.nextShardAt = time + Phaser.Math.Between(680, 1120) / this.difficulty;
    }

    if (time > this.nextCoralAt) {
      this.spawnCoral();
      this.nextCoralAt = time + Phaser.Math.Between(900, 1500);
    }
  }

  spawnNectar() {
    const y = Phaser.Math.Between(90, Math.max(120, this.height - 90));
    const object = this.add.sprite(this.width + 60, y, "nectar")
      .setScale(Phaser.Math.FloatBetween(0.34, 0.52))
      .setBlendMode(Phaser.BlendModes.ADD);

    object.speed = Phaser.Math.Between(120, 175) * this.difficulty;
    object.radius = 24;
    this.nectar.push(object);

    this.tweens.add({
      targets: object,
      scale: object.scale * 1.22,
      alpha: 0.72,
      duration: 680,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
  }

  spawnShard() {
    const y = Phaser.Math.Between(80, Math.max(100, this.height - 80));
    const scale = Phaser.Math.FloatBetween(0.56, 0.88);
    const object = this.add.sprite(this.width + 70, y, "shard")
      .setScale(scale)
      .setRotation(Phaser.Math.FloatBetween(-0.8, 0.8));

    object.speed = Phaser.Math.Between(165, 240) * this.difficulty;
    object.spin = Phaser.Math.FloatBetween(-1.7, 1.7);
    object.wave = Phaser.Math.FloatBetween(1.2, 2.8);
    object.birthY = y;
    object.radius = 26 * scale;
    this.shards.push(object);
  }

  spawnCoral() {
    const y = Phaser.Math.Between(0, this.height);
    const object = this.add.sprite(this.width + 80, y, "coral")
      .setScale(Phaser.Math.FloatBetween(0.38, 0.82))
      .setAlpha(0.34)
      .setDepth(-1)
      .setBlendMode(Phaser.BlendModes.ADD);

    object.speed = Phaser.Math.Between(26, 58) * this.difficulty;
    object.spin = Phaser.Math.FloatBetween(-0.08, 0.08);
    this.reef.push(object);
  }

  updatePlayer(dt) {
    const keyboardVector = new Phaser.Math.Vector2(0, 0);

    if (this.keys.A.isDown || this.keys.LEFT.isDown) keyboardVector.x -= 1;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) keyboardVector.x += 1;
    if (this.keys.W.isDown || this.keys.UP.isDown) keyboardVector.y -= 1;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) keyboardVector.y += 1;

    if (keyboardVector.lengthSq() > 0) {
      keyboardVector.normalize().scale(this.isDashing ? 760 : 420);
      this.player.x += keyboardVector.x * dt;
      this.player.y += keyboardVector.y * dt;
      this.pointerTarget.set(this.player.x, this.player.y);
    } else {
      const follow = this.isDashing ? 18 : 8.5;
      this.player.x = Phaser.Math.Linear(this.player.x, this.pointerTarget.x, follow * dt);
      this.player.y = Phaser.Math.Linear(this.player.y, this.pointerTarget.y, follow * dt);
    }

    this.player.x = Phaser.Math.Clamp(this.player.x, 36, this.width - 36);
    this.player.y = Phaser.Math.Clamp(this.player.y, 46, this.height - 36);
    this.player.rotation = Phaser.Math.Clamp((this.pointerTarget.y - this.player.y) * 0.004, -0.35, 0.35);
    this.playerGlow.setPosition(this.player.x, this.player.y);

    const isInvulnerable = this.time.now < this.invulnerableUntil;
    this.player.setAlpha(isInvulnerable && Math.sin(this.time.now * 0.04) > 0 ? 0.42 : 1);
  }

  updateObjects(dt) {
    this.moveAndCull(this.nectar, dt, (object) => {
      object.x -= object.speed * dt;
      object.rotation += 0.4 * dt;
    });

    this.moveAndCull(this.shards, dt, (object) => {
      object.x -= object.speed * dt;
      object.rotation += object.spin * dt;
      object.y = object.birthY + Math.sin((this.time.now + object.x * 12) * 0.001 * object.wave) * 34;
    });

    this.moveAndCull(this.reef, dt, (object) => {
      object.x -= object.speed * dt;
      object.rotation += object.spin * dt;
    });
  }

  moveAndCull(collection, dt, updater) {
    for (let index = collection.length - 1; index >= 0; index -= 1) {
      const object = collection[index];
      updater(object, dt);
      if (object.x < -120) {
        object.destroy();
        collection.splice(index, 1);
      }
    }
  }

  checkCollisions(time) {
    for (let index = this.nectar.length - 1; index >= 0; index -= 1) {
      const object = this.nectar[index];
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, object.x, object.y) < object.radius + 23) {
        this.collectNectar(object);
        this.nectar.splice(index, 1);
      }
    }

    if (time < this.invulnerableUntil) {
      return;
    }

    for (let index = this.shards.length - 1; index >= 0; index -= 1) {
      const object = this.shards[index];
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, object.x, object.y) < object.radius + 20) {
        this.hitShard(object);
        this.shards.splice(index, 1);
        break;
      }
    }
  }

  collectNectar(object) {
    const now = this.time.now;
    this.combo = now - this.lastCollectAt < 1600 ? Math.min(9, this.combo + 1) : 1;
    this.lastCollectAt = now;
    this.score += 120 * this.combo;
    this.synth.collect();
    this.emitBurst(object.x, object.y, "spark", 18, "#65ffe1");
    object.destroy();
  }

  hitShard(object) {
    this.lives -= 1;
    this.combo = 1;
    this.invulnerableUntil = this.time.now + 1250;
    this.cameras.main.shake(220, 0.008);
    this.synth.hurt();
    this.emitBurst(object.x, object.y, "glow", 12, "#ff7bd8");
    object.destroy();

    if (this.lives <= 0) {
      this.endGame();
    }
  }

  tryDash() {
    if (!this.canDash || !this.isPlaying) {
      return;
    }

    this.canDash = false;
    this.isDashing = true;
    this.invulnerableUntil = Math.max(this.invulnerableUntil, this.time.now + 360);
    this.synth.dash();
    this.createDashRing();

    this.time.delayedCall(230, () => {
      this.isDashing = false;
    });

    this.time.delayedCall(1400, () => {
      this.canDash = true;
    });
  }

  createDashRing() {
    const ring = this.add.circle(this.player.x, this.player.y, 18, 0x65ffe1, 0)
      .setStrokeStyle(3, 0x65ffe1, 0.9)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.tweens.add({
      targets: ring,
      radius: 108,
      alpha: 0,
      duration: 460,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy()
    });
  }

  emitBurst(x, y, texture, quantity) {
    const emitter = this.add.particles(x, y, texture, {
      speed: { min: 70, max: 220 },
      lifespan: { min: 340, max: 760 },
      scale: { start: 0.45, end: 0 },
      alpha: { start: 0.95, end: 0 },
      quantity,
      emitting: false,
      blendMode: "ADD"
    });

    emitter.explode(quantity, x, y);
    this.time.delayedCall(850, () => emitter.destroy());
  }

  endGame() {
    this.isPlaying = false;
    this.isGameOver = true;
    this.synth.gameOver();
    this.cameras.main.flash(360, 255, 123, 216, false);

    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      this.saveBestScore(this.bestScore);
    }

    this.messageText.setText(`Reef dimmed\nScore ${this.score}\nPress Enter or click to retry`);
    this.updateHud();
  }

  updateHud() {
    this.scoreText.setText(`Score ${this.score}`);
    this.comboText.setText(`Chain x${this.combo}`);
    this.livesText.setText(`Lives ${Math.max(0, this.lives)}  ${this.canDash ? "Dash ready" : "Dash charging"}`);
    this.bestText.setText(`Best ${this.bestScore}`);
  }

  loadBestScore() {
    try {
      return Number.parseInt(window.localStorage.getItem(STORAGE_KEY) || "0", 10);
    } catch (error) {
      return 0;
    }
  }

  saveBestScore(score) {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(score));
    } catch (error) {
      // Private browsing or local security settings can disable storage.
    }
  }
}

const config = {
  type: Phaser.AUTO,
  parent: "game-wrap",
  backgroundColor: "#030412",
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false
  },
  scene: LumenReefScene
};

window.addEventListener("load", () => {
  if (!window.Phaser) {
    document.body.innerHTML = "<p style='padding:24px;color:white;font-family:sans-serif'>Phaser could not be loaded. Check your internet connection for the CDN script.</p>";
    return;
  }

  new Phaser.Game(config);
});
