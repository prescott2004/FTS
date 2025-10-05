// import
import { FT } from './script_class.js';
import { drawBox, clipRect, noClip } from './script_util.js';
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

// カスタム式
const CUSTOM_EXPR = 'sin(2*x)+0.5*sin(5*x)'; // 簡易カスタム式
// クラス
const fourierTransform = new FT(SPEED_MAX, SPEED_MIN, SPEED_DEFAULT, SPEED_STEP, W_MAX_LIMIT_MAX, W_MAX_LIMIT_MIN, W_MAX_DEFAULT, W_MAX_STEP, W_STEP, N_SAMPLES, T_MIN, T_MAX, PAD_COMMON, PAD_H_LEGEND, SCALE_SMOOTH_K, RGB_STEP, RGB_DEFAULT, CUSTOM_EXPR); // FTクラスのインスタンス

// 可変変数
// ======= 関数定義（必要ならここを編集） =======
window.setup = () => {
    // 今のブラウザのサイズに合わせる
    createCanvas(windowWidth - fourierTransform.PAD_COMMON, windowHeight - fourierTransform.PAD_COMMON * 3);
    pixelDensity(2);
    // tとf(t)の事前計算
    // 描画の速さ（一秒間に何回draw呼び出し）
    frameRate(60);
}

// ウィンドウリサイズ対応
window.windowResized = () => {
    resizeCanvas(windowWidth, windowHeight);
}

// キーボード操作
window.keyPressed = () => {
    if (keyCode == ESCAPE) {
        fourierTransform.resetTransform();
        return false; // prevent default
    }
    switch (key) {
        case ' ':
            fourierTransform.isPaused = !fourierTransform.isPaused;
            break;
        case 'a': case 'A':
            fourierTransform.showAbs = !fourierTransform.showAbs;
            break;
        case 'r': case 'R':
            fourierTransform.showRe = !fourierTransform.showRe;
            break;
        case 'i': case 'I':
            fourierTransform.showIm = !fourierTransform.showIm;
            break;
        case '[':
            fourierTransform.speed = Math.max(fourierTransform.SPEED_MIN, fourierTransform.speed - fourierTransform.SPEED_STEP);
            break;
        case ']':
            fourierTransform.speed = Math.min(fourierTransform.SPEED_MAX, fourierTransform.speed + fourierTransform.SPEED_STEP);
            break;
        case '-':
            fourierTransform.wMax = Math.max(fourierTransform.W_MAX_LIMIT_MIN, fourierTransform.wMax - fourierTransform.W_MAX_STEP);
            fourierTransform.resetTransform();
            break;
        case '=':
            fourierTransform.wMax = Math.min(fourierTransform.W_MAX_LIMIT_MAX, fourierTransform.wMax + fourierTransform.W_MAX_STEP);
            fourierTransform.resetTransform();
            break;
        case 'z': case 'Z':
            fourierTransform.showScaleHUD = !fourierTransform.showScaleHUD;
            break;
        case '1': case '2': case '3': case '4': case '5': case '6':
            fourierTransform.funcType = int(key);
            fourierTransform.recomputeFt();
            fourierTransform.resetTransform();
            break;
    }
    return false; // prevent default
}


window.draw = () => {
    // 最大ωに達したら一時停止
    if (fourierTransform.wCurrent >= fourierTransform.wMax) {
        fourierTransform.isPaused = true;
    }
    // 背景 (R,G,B,alpha)
    background(11, 13, 16);
    // レイアウト: 左=時間領域(上: f(x), 下: 複素平面) / 右=周波数領域
    const box_width = (width - fourierTransform.PAD_COMMON * 3) * 0.50;
    const box_height = (height - fourierTransform.PAD_COMMON * 4 - fourierTransform.PAD_H_LEGEND) * 0.50;

    // 1) f(t)のプロット
    // -------------------------------------------------------
    // 現在の設定を保存
    push();
    // 原点ずらし
    translate(fourierTransform.PAD_COMMON, fourierTransform.PAD_COMMON + fourierTransform.PAD_H_LEGEND);
    // 枠とタイトルの描画
    drawBox(box_width, box_height, '時間領域: f(t)');
    // 整理：枠外にはみ出さないように表示を制限
    clipRect(0, 0, box_width, box_height);
    fourierTransform.plotFt(box_width, box_height);
    noClip();
    // 設定を戻す
    pop();

    // 3) 複素平面 描画
    // -------------------------------------------------------
    push();
    // 原点ずらし
    translate(fourierTransform.PAD_COMMON, fourierTransform.PAD_COMMON * 2 + fourierTransform.PAD_H_LEGEND + box_height);
    // 枠とタイトルの描画
    drawBox(box_width, box_height, `複素平面: F(ω)の積分過程  ω=${fourierTransform.wCurrent.toFixed(2)}`);
    // 整理：枠外にはみ出さないように表示を制限
    clipRect(0, 0, box_width, box_height);
    // 複素平面での積分の様子を描画
    fourierTransform.plotComplexPath(box_width, box_height);
    // 表示制限解除
    noClip();
    pop();

    // 4) 周波数領域 プロット（|F(ω)|, Re, Im）
    push();
    // 原点ずらし
    translate(fourierTransform.PAD_COMMON * 2 + box_width, fourierTransform.PAD_COMMON + fourierTransform.PAD_H_LEGEND);
    drawBox(box_width, box_height * 2, '周波数領域: |F(ω)|(金), Re(赤), Im(青)');
    clipRect(0, 0, box_width, box_height * 2);
    fourierTransform.plotSpectrum(box_width, box_height * 2);
    noClip();
    pop();

    // ステータス
    noStroke(); fill(230);
    textSize(12);
    text(`t範囲: [${fourierTransform.T_MIN}, ${fourierTransform.T_MAX}]  ω範囲: [-${fourierTransform.wMax}, +${fourierTransform.wMax}]  速度×${fourierTransform.speed.toFixed(2)}  サンプル: N=${fourierTransform.N_SAMPLES}  dt=${fourierTransform.dt.toFixed(3)}`,
        fourierTransform.PAD_COMMON, height - 10);

    // 進める
    // -------------------------------------------------------
    if (!fourierTransform.isPaused) {
        fourierTransform.wCurrent += fourierTransform.W_STEP * fourierTransform.speed;
    }
}


