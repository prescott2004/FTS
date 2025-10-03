// import
import { f_of_t } from './script_func.js';
// const変数
const SPEED_MIN = 0.25; // 最小速度係数
const SPEED_MAX = 8;    // 最大速度係数
const SPEED_DEFAULT = 1; // 初期速度係数
const SPEED_STEP = 0.1; // 速度係数の変化ステップ
const W_MAX_LIMIT_MAX = 120; // ωの最大値の上限
const W_MAX_LIMIT_MIN = 5; // ωの最大値の下限
const W_MAX_DEFAULT = 20; // ωの最大値の初期値
const W_MAX_STEP = 5; // ωの最大値の変化ステップ
const W_STEP = 0.05; // ωの変化ステップ
const N_SAMPLES = 1024; // サンプル数
const T_MIN = -10 // tの最小値
const T_MAX = 10;  // tの最大値
// 余白関係
const PAD_COMMON = 16; // 共通の余白
const PAD_H_LEGEND = 180; // 上の余白（凡例のため）
// 複素平面のスケール関連
const SCALE_SMOOTH_K = 0.1; // スケール平滑化係数 (0~1)
// RGB関連
const RGB_STEP = 1; // RGBの変化ステップ
const RGB_DEFAULT = [255, 215, 0]; // RGBの初期値（金色）


// 可変変数
let isPaused = false; // アニメーション一時停止
let speed = SPEED_DEFAULT;         // フレームごとのωステップ係数
let wMax = W_MAX_DEFAULT;         // ωの最大値[-w_max,+w_max]
let wCurrent = -wMax;  // 現在のω
let ft = new Array(N_SAMPLES);
let ts = new Array(N_SAMPLES);
let dt; // 積分の微小区間幅
let spectrum = [];     // 記録: {w, Re, Im, Abs}
let customExpr = 'sin(2*x)+0.5*sin(5*x)'; // 簡易カスタム式
let funcType = 1;      // 関数タイプ．初期: Gaussian
// 複素平面スケール関連
let rMaxVisual = 1e-6 // 複素平面の表示上の最大半径（動的に変化）
let rMaxTarget = 1e-6; // 複素平面の目標最大半径（動的に変化）
let showScaleHUD = true; // スケールHUD表示
// 周波数領域関連
let showAbs = true; // |F(ω)|表示
let showRe = true;  // Re(F(ω))表示
let showIm = true;  // Im(F(ω))表示
// HSV
let hue = 0; // 色相

// ======= 関数定義（必要ならここを編集） =======
function setup() {
    // 今のブラウザのサイズに合わせる
    createCanvas(windowWidth - PAD_COMMON, windowHeight - PAD_COMMON * 2);
    pixelDensity(2);
    // 積分の解析計算用の微小区間幅
    dt = (T_MAX - T_MIN) / (N_SAMPLES - 1);
    // tとf(t)の事前計算
    for (let i = 0; i < N_SAMPLES; i++) {
        const t = T_MIN + i * dt;
        ts[i] = t;
        ft[i] = f_of_t(t, 1);
    }
    // 描画の速さ（一秒間に何回draw呼び出し）
    frameRate(60);
}

// ウィンドウリサイズ対応
function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}

// キーボード操作
function keyPressed() {
    if (keyCode == ESCAPE) {
        resetTransform();
        return false; // prevent default
    }
    switch (key) {
        case ' ':
            isPaused = !isPaused;
            break;
        case 'a': case 'A':
            showAbs = !showAbs;
            break;
        case 'r': case 'R':
            showRe = !showRe;
            break;
        case 'i': case 'I':
            showIm = !showIm;
            break;
        case '[':
            speed = Math.max(SPEED_MIN, speed - SPEED_STEP);
            break;
        case ']':
            speed = Math.min(SPEED_MAX, speed + SPEED_STEP);
            break;
        case '-':
            wMax = Math.max(W_MAX_LIMIT_MIN, wMax - W_MAX_STEP);
            resetTransform();
            break;
        case '=':
            wMax = Math.min(W_MAX_LIMIT_MAX, wMax + W_MAX_STEP);
            resetTransform();
            break;
        case 'z': case 'Z':
            showScaleHUD = !showScaleHUD;
            break;
        case '1': case '2': case '3': case '4': case '5': case '6':
            funcType = int(key);
            recomputeFt();
            resetTransform();
            break;
    }
    return false; // prevent default
}

function recomputeFt(funcType) {
    // f(t)の再計算(関数タイプ変更時)
    for (let i = 0; i < N_SAMPLES; i++) {
        ft[i] = f_of_t(ts[i], funcType);
    }
}

function resetTransform() {
    spectrum = [];
    wCurrent = -wMax;
    isPaused = false;
}

function draw() {
    // 最大ωに達したら一時停止
    if (wCurrent >= wMax) {
        isPaused = true;
    }
    // 背景 (R,G,B,alpha)
    background(11, 13, 16);
    // レイアウト: 左=時間領域(上: f(x), 下: 複素平面) / 右=周波数領域
    const box_width = (width - PAD_COMMON * 3) * 0.50;
    const box_height = (height - PAD_COMMON * 4 - PAD_H_LEGEND) * 0.50;

    // 1) f(t)のプロット
    // -------------------------------------------------------
    // 現在の設定を保存
    push();
    // 原点ずらし
    translate(PAD_COMMON, PAD_COMMON + PAD_H_LEGEND);
    // 枠とタイトルの描画
    drawBox(box_width, box_height, '時間領域: f(t)');
    // 整理：枠外にはみ出さないように表示を制限
    clipRect(0, 0, box_width, box_height);
    plotFt(box_width, box_height);
    noClip();
    // 設定を戻す
    pop();

    // 2) 複素平面での積分の様子（現在のω）
    // -------------------------------------------------------
    let curRe = 0, curIm = 0;
    let path = [];
    for (let i = 0; i < N_SAMPLES; i++) {
        const t = ts[i];
        const f = ft[i];
        const phi = -wCurrent * t; // e^{-jωt}
        const cRe = Math.cos(phi);
        const cIm = Math.sin(phi);
        // 積分を総和で近似してるが、両端だけ半分の重み（0.5） を与えて、端点の寄与を正しくする
        const weight = (i === 0 || i === N_SAMPLES - 1) ? 0.5 : 1.0;
        curRe += f * cRe * weight * dt;
        curIm += f * cIm * weight * dt;
        path.push([curRe, curIm]);
    }
    const curAbs = Math.hypot(curRe, curIm);
    spectrum.push({ w: wCurrent, Re: curRe, Im: curIm, Abs: curAbs });


    // 3) 複素平面 描画
    // -------------------------------------------------------
    push();
    // 原点ずらし
    translate(PAD_COMMON, PAD_COMMON * 2 + PAD_H_LEGEND + box_height);
    // 枠とタイトルの描画
    drawBox(box_width, box_height, `複素平面: F(ω)の積分過程  ω=${wCurrent.toFixed(2)}`);
    // 整理：枠外にはみ出さないように表示を制限
    clipRect(0, 0, box_width, box_height);
    // 複素平面での積分の様子を描画
    plotComplexPath(path, box_width, box_height);
    // 表示制限解除
    noClip();
    pop();

    // 4) 周波数領域 プロット（|F(ω)|, Re, Im）
    push();
    // 原点ずらし
    translate(PAD_COMMON * 2 + box_width, PAD_COMMON + PAD_H_LEGEND);
    drawBox(box_width, box_height * 2, '周波数領域: |F(ω)|(金), Re(赤), Im(青)');
    clipRect(0, 0, box_width, box_height * 2);
    // plotSpectrum(box_width, height - (PAD_COMMON + PAD_H_LEGEND) * 2);
    plotSpectrum(box_width, box_height * 2);
    noClip();
    pop();

    // ステータス
    noStroke(); fill(230);
    textSize(12);
    text(`t範囲: [${T_MIN}, ${T_MAX}]  ω範囲: [-${wMax}, +${wMax}]  速度×${speed.toFixed(2)}  サンプル: N=${N_SAMPLES}  dt=${dt.toFixed(3)}`,
        PAD_COMMON, height - 10);

    // 進める
    // -------------------------------------------------------
    if (!isPaused) {
        wCurrent += W_STEP * speed;
    }
}

// ======= 描画ユーティリティ =======
// 枠とタイトル
function drawBox(w, h, title) {
    // 枠
    stroke(255, 255, 255); // 枠の色 (R,G,B)
    noFill(); // 塗りつぶしなし
    rect(0, 0, w, h, 10); // 角丸四角形(x, y, w, h, r) x,yは左上
    // タイトル
    noStroke(); // 枠線なし
    fill(255); // 文字色 (R,G,B)
    textSize(12); // 文字サイズ
    text(title, 10, 16); // 位置(x, y) yはベースライン
}
// 表示領域制限
function clipRect(x, y, w, h) {
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.rect(x, y, w, h);
    drawingContext.clip();
    translate(x, y);
}
// 表示領域制限解除
function noClip() { drawingContext.restore(); }

// f(t)のプロット
function plotFt(w, h) {
    // 軸
    push();
    stroke(128); // 軸の色
    line(PAD_COMMON * 0.5, h - PAD_COMMON, w - PAD_COMMON, h - PAD_COMMON); // x軸の描画 (x1, y, x2, y)
    line(PAD_COMMON, PAD_COMMON * 2.5, PAD_COMMON, h - PAD_COMMON * 0.5); // x軸の描画 (x1, y, x2, y)); // y軸の描画 (x, y1, x, y2)
    // ラベル
    noStroke();
    fill(160); // ラベルの色
    textSize(11); // ラベルの文字サイズ
    text('x', w - PAD_COMMON + 4, h - PAD_COMMON + 4);
    text('f(x)', PAD_COMMON * 0.5, PAD_COMMON * 2);
    // 0ライン
    const x0 = PAD_COMMON;
    const x1 = w - PAD_COMMON;
    const y0 = h - PAD_COMMON;
    const y1 = PAD_COMMON * 2.5;
    const yc = (h + PAD_COMMON * 1.5) / 2;
    stroke(192, 192, 192, 128);
    line(x0, yc, x1, yc);

    // スケール
    const sx = (x1 - x0) / (T_MAX - T_MIN);
    const sy = (y0 - y1) * 0.45; // スケール
    // 曲線
    noFill();
    stroke(RGB_DEFAULT[0], RGB_DEFAULT[1], RGB_DEFAULT[2]); // 曲線の色 (R,G,B)
    beginShape(); // 線分の開始
    for (let i = 0; i < N_SAMPLES; i++) {
        const x = ts[i];
        const y = ft[i];
        const px = x0 + (x - T_MIN) * sx;
        const py = yc - y * sy;
        vertex(px, py);
    }
    endShape(); // 線分の終了
    // 目盛り
    stroke(192, 192, 192, 64);
    for (let k = T_MIN + 1; k <= T_MAX; k++) {
        const px = x0 + (k - T_MIN) * sx;
        if (k == 0) {
            stroke(192, 192, 192, 128);
        } else {
            stroke(192, 192, 192, 64);
        }
        line(px, y1, px, y0 + PAD_COMMON * 0.5);
    }
    pop();
}

// 複素平面での積分の様子
function plotComplexPath(path, w, h) {
    const x0 = PAD_COMMON;
    const x1 = w - PAD_COMMON;
    const y0 = h - PAD_COMMON;
    const y1 = PAD_COMMON * 1.5;
    const xc = (x0 + x1) / 2;
    const yc = (y0 + y1) / 2;
    // スケールは動的（パスの広がりに合わせる）: アニメーションごとに変わる自動スムージング
    let rMaxTarget = 1e-6;
    for (const [xr, xi] of path) { rMaxTarget = Math.max(rMaxTarget, Math.hypot(xr, xi)); } // パスの最大半径を求める
    // スケールの初期化
    if (frameCount <= 2 && rMaxVisual < 1e-5) {
        rMaxVisual = rMaxTarget;
    }
    // 表示スケール更新
    rMaxVisual += (rMaxTarget - rMaxVisual) * SCALE_SMOOTH_K; // 平滑化
    rMaxVisual = Math.max(rMaxVisual, 1e-6); // 0防止
    const scaleSmooth = 0.85 * Math.min(x1 - x0, y0 - y1) / 2 / rMaxVisual; // 最大半径が画面の85%に収まるように

    // 軸
    push();
    stroke(128); // 軸の色
    line(x0, yc, x1, yc); // Re軸の描画
    line(xc, y1, xc, y0); // Im軸の描画
    // ラベル
    noStroke();
    fill(160);
    textSize(11);
    text('Re', x1 - PAD_COMMON, yc - PAD_COMMON * 0.5);
    text('Im', xc + PAD_COMMON * 0.5, y1 + PAD_COMMON * 0.5);

    // スケールHUD
    if (showScaleHUD) {
        // 円を複数描く
        for (let i = 0; i <= 5; i++) {
            // 大きい円
            fill(51 * i, 51 * i, 51 * i, 64);
            stroke(220);
            strokeWeight(1.5);
            circle(xc, yc, 2 * scaleSmooth / Math.pow(2, i)); // 現在（平滑）
        }
        // テキスト
        noStroke();
        fill(255, 255, 255,);
        textSize(12);
        text(`scale 1unit = ${scaleSmooth.toFixed(0)}px, α=${SCALE_SMOOTH_K.toFixed(2)}`,
            x0 + 8, y0 - 8);
    }


    // パス
    colorMode(HSB, 360, 100, 100); // 色相環で色を変化させる設定
    if (!isPaused) {
        hue = (frameCount * 2) % 360; // 色相を変化させる
    }
    stroke(hue, 100, 100);
    noFill();
    beginShape();
    for (const [i, [xr, xi]] of path.entries()) {
        const px = xc + xr * scaleSmooth;
        const py = yc - xi * scaleSmooth;
        vertex(px, py);
    }
    endShape();
    colorMode(RGB, 255); // 元に戻す

    // 末端ベクトル: 最終的に計算されるF(ω)
    const [xr, xi] = path[path.length - 1];
    const px = xc + xr * scaleSmooth;
    const py = yc - xi * scaleSmooth;
    fill(RGB_DEFAULT);
    noStroke();
    circle(px, py, 10);
    pop();
}

// 周波数領域のプロット（|F(ω)|, Re, Im）
function plotSpectrum(w, h) {
    // 座標の位置
    const x0 = PAD_COMMON;
    const x1 = w - PAD_COMMON * 5;
    const y0 = h - PAD_COMMON;
    const y1 = PAD_COMMON * 1.5;
    // -wMAX ~ +wMAX を x0 ~ x1 にマッピングする関数
    const sx = (x1 - x0) / (2 * wMax); // 1ラジアンあたり何ピクセル動かすか
    function wToX(wv) { return x0 + (wv + wMax) * sx; }
    const xw = wToX(wCurrent); // 現在のωの位置: x座標
    const xc = (x0 + x1) / 2;
    const yc = (y0 + y1) / 2;
    // 軸
    push();
    stroke(128); // 軸の色
    line(x0, yc, x1, yc); // x軸
    line(x0, y1, x0, y0); // y軸
    line(xc, y1, xc, y0); // ω=0の線
    // ラベル
    noStroke();
    fill(160);
    textSize(11);
    text('ω', x1 - PAD_COMMON, yc - PAD_COMMON * 0.5);
    text('|F(ω)|', x0 + PAD_COMMON * 0.5, y1 + PAD_COMMON);


    // 縦スケール（動的）
    let yMax = 1e-6;
    // グラフ全体で縦の最大値を求める
    for (const s of spectrum) {
        yMax = Math.max(yMax, Math.abs(s.Abs), Math.abs(s.Re), Math.abs(s.Im));
    }
    const sy = (y0 - y1) / (2.2 * yMax); //

    // |F(ω)|
    noFill();
    if (showAbs) {
        stroke(RGB_DEFAULT[0], RGB_DEFAULT[1], RGB_DEFAULT[2], 192); // 曲線の色 (R,G,B)
        strokeWeight(3); // 線の太さ
        beginShape();
        // 毎回、最初からすべて書き直してる
        for (const s of spectrum) {
            vertex(wToX(s.w), yc - s.Abs * sy);
        }
        endShape();
    }
    // Re
    if (showRe) {
        stroke(255, 0, 0, 192);
        strokeWeight(3); // 線の太さ
        beginShape();
        // 毎回、最初からすべて書き直してる
        for (const s of spectrum) {
            vertex(wToX(s.w), yc - s.Re * sy);
        }
        endShape();
    }
    // Im
    if (showIm) {
        stroke(0, 0, 255, 192);
        strokeWeight(3); // 線の太さ
        beginShape();
        // 毎回、最初からすべて書き直してる
        for (const s of spectrum) {
            vertex(wToX(s.w), yc - s.Im * sy);

        }
        endShape();
    }

    // 現在位置までを塗りつぶす
    colorMode(HSB, 360, 100, 100); // 色相環で色を変化させる設定
    if (!isPaused) {
        hue = (frameCount * 2) % 360; // 色相を変化させる
    }
    noStroke();
    fill(hue, 100, 100, 0.2);
    rect(x0, y1, xw - x0, y0 - y1);
    colorMode(RGB, 255); // 元に戻す

    // 周波数を数値表示
    noStroke();
    fill(255);
    textSize(24);
    text(`${(wCurrent / (2 * Math.PI)).toFixed(1)}Hz`, xw + 10, y1 + 80);

    pop();
}
