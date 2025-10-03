// ====== Audio ======
let sound, mic, fft, amp;
let usingMic = false;

// ====== Visual ======
let trail;                // 残像用バッファ
let particles = [];
let hudWave = true;       // 波形HUD表示
let palette = 0;          // カラープリセット

// ====== UI refs ======
let pcountEl, fadeEl, satEl;

function setup() {
    createCanvas(windowWidth, windowHeight, WEBGL);
    pixelDensity(window.devicePixelRatio || 1);
    colorMode(HSB, 360, 100, 100, 1);

    // 残像用オフスクリーン
    trail = createGraphics(width, height);
    trail.colorMode(HSB, 360, 100, 100, 1);

    fft = new p5.FFT(0.9, 1024);
    amp = new p5.Amplitude();

    // 粒子初期化
    initParticles(4000);

    // UI wiring
    const playBtn = document.getElementById('play');
    playBtn.onclick = async () => {
        if (getAudioContext().state !== 'running') await getAudioContext().resume();
        if (sound && sound.isLoaded()) {
            if (sound.isPlaying()) sound.pause(); else sound.loop();
        }
    };

    document.getElementById('file').addEventListener('change', e => {
        if (e.target.files?.[0]) loadFromFile(e.target.files[0]);
    });

    document.getElementById('mic').onclick = async () => {
        if (!mic) { mic = new p5.AudioIn(); await mic.start(); }
        usingMic = true; fft.setInput(mic); amp.setInput(mic);
        if (sound) { sound.stop(); }
    };

    pcountEl = document.getElementById('pcount');
    fadeEl = document.getElementById('fade');
    satEl = document.getElementById('sat');

    // DnD
    ;['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
        document.body.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); });
    });
    document.body.addEventListener('drop', e => {
        const f = e.dataTransfer.files?.[0]; if (f) loadFromFile(f);
    });

    // right click: HUD
    window.addEventListener('contextmenu', e => { e.preventDefault(); hudWave = !hudWave; });
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    const g = createGraphics(width, height); // 解像度更新
    g.colorMode(HSB, 360, 100, 100, 1);
    g.image(trail, 0, 0, width, height);
    trail.remove(); trail = g;
}

function mousePressed() { palette = (palette + 1) % 3; }

function initParticles(n) {
    particles = new Array(n).fill().map(() => ({
        x: random(width), y: random(height), a: random(TWO_PI), v: random(0.4, 1.2), s: random(0.8, 1.4)
    }));
}

function loadFromFile(file) {
    usingMic = false; if (mic) mic.stop();
    if (sound) { sound.stop(); sound.disconnect(); }
    soundFormats('mp3', 'wav', 'ogg', 'm4a');
    sound = loadSound(URL.createObjectURL(file), () => { fft.setInput(sound); amp.setInput(sound); sound.play(); });
}

function draw() {
    // 粒子数が変更されたら反映
    const targetCount = int(pcountEl.value);
    if (targetCount !== particles.length) initParticles(targetCount);

    const fade = parseFloat(fadeEl.value); // 0.02–0.2
    const sat = parseFloat(satEl.value);  // 20–100

    // 背景(残像フェード) in offscreen
    trail.noStroke(); trail.fill(0, 0, 0, fade); trail.rect(0, 0, width, height);

    const spec = fft.analyze();
    const level = amp.getLevel();
    const bass = fft.getEnergy('bass');
    const mid = fft.getEnergy('mid');
    const treb = fft.getEnergy('treble');
    const centroid = fft.getCentroid();

    // カラーパレット
    let hueBase;
    if (palette === 0) hueBase = map(centroid, 200, 4000, 200, 330, true);         // 青紫系（幻想）
    else if (palette === 1) hueBase = map(centroid, 200, 4000, 40, 80, true);      // 黄金～翡翠（温かい）
    else hueBase = map(centroid, 200, 4000, 180, 220, true);                       // 青～水色（無機質）

    // 流れ場パラメータ
    const t = millis() * 0.00015;
    const flowScale = 0.0015 + level * 0.012;     // 音量で流れの細かさが変化
    const speedMul = 0.6 + level * 6;            // 音量で速度UP

    // 加算合成で光の重なり
    trail.blendMode(ADD);
    for (const p of particles) {
        // 角度更新（Perlinベースの流れ場）
        const nx = noise(p.x * flowScale, p.y * flowScale, t);
        const ny = noise(p.y * flowScale, p.x * flowScale, t + 100);
        p.a += (nx - 0.5) * 0.7 + (ny - 0.5) * 0.7;
        const sp = speedMul * p.v;
        p.x = (p.x + Math.cos(p.a) * sp + width) % width;
        p.y = (p.y + Math.sin(p.a) * sp + height) % height;

        // 色と明るさ
        const hue = (hueBase + nx * 60 + frameCount * 0.05) % 360;
        const bri = map(bass + mid + treb, 0, 765, 25, 95);

        // 粒のコア
        trail.noStroke();
        trail.fill(hue, sat, bri, 0.12);
        trail.circle(p.x, p.y, 2 * p.s + level * 10);
        // ソフトグロウ（外側）
        trail.fill(hue, sat * 0.7, bri, 0.035);
        trail.circle(p.x, p.y, 10 * p.s + level * 60);
    }
    trail.blendMode(BLEND);

    // 画面へ貼る
    background(0);
    resetMatrix(); // WEBGL→スクリーン
    image(trail, -width / 2, -height / 2, width, height);

    // HUD(波形ミニ表示)
    if (hudWave) {
        const wave = fft.waveform(256);
        push(); resetMatrix(); translate(-width / 2 + 16, -height / 2 + 16);
        noFill(); stroke(210, 30, 95, .85); strokeWeight(1.4);
        // frame
        fill(0, 0, 100, .05); noStroke(); rect(0, 0, 220, 60, 8);
        // wave
        noFill(); stroke(210, 30, 95, .9); beginShape();
        for (let i = 0; i < wave.length; i++) {
            const x = map(i, 0, wave.length - 1, 8, 212);
            const y = map(wave[i], -1, 1, 8, 52);
            vertex(x, y);
        }
        endShape(); pop();
    }

    // フッターテキスト
    push(); resetMatrix(); fill(0, 0, 100, .7); textSize(12);
    const src = usingMic ? 'MIC' : (sound && sound.isPlaying() ? 'FILE (playing)' : 'FILE (paused)');
    text(`Source: ${src} | Particles: ${particles.length} | Fade: ${nf(fade, 1, 2)} | Palette: ${palette}`, -width / 2 + 16, height / 2 - 14);
    pop();
}
