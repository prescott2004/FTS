export class FT {
    constructor(SPEED_MAX, SPEED_MIN, SPEED_DEFAULT, SPEED_STEP, W_MAX_LIMIT_MAX, W_MAX_LIMIT_MIN, W_MAX_DEFAULT, W_MAX_STEP, W_STEP, N_SAMPLES, T_MIN, T_MAX, PAD_COMMON, PAD_H_LEGEND, SCALE_SMOOTH_K, RGB_STEP, RGB_DEFAULT, CUSTOM_EXPR) {
        // 定数
        this.SPEED_MIN = SPEED_MIN; // 最小速度係数
        this.SPEED_MAX = SPEED_MAX;    // 最大速度係数
        this.SPEED_DEFAULT = SPEED_DEFAULT; // 初期速度係数
        this.SPEED_STEP = SPEED_STEP; // 速度係数の変化ステップ
        this.W_MAX_LIMIT_MAX = W_MAX_LIMIT_MAX; // ωの最大値の上限
        this.W_MAX_LIMIT_MIN = W_MAX_LIMIT_MIN; // ωの最大値の下限
        this.W_MAX_DEFAULT = W_MAX_DEFAULT; // ωの最大値の初期値
        this.W_MAX_STEP = W_MAX_STEP; // ωの最大値の変化ステップ
        this.W_STEP = W_STEP; // ωの変化ステップ
        this.N_SAMPLES = N_SAMPLES; // サンプル数
        this.T_MIN = T_MIN; // tの最小値
        this.T_MAX = T_MAX;  // tの最大値
        this.PAD_COMMON = PAD_COMMON; // 共通の余白
        this.PAD_H_LEGEND = PAD_H_LEGEND; // 上の余白（凡例のため）
        this.SCALE_SMOOTH_K = SCALE_SMOOTH_K; // スケール平滑化係数 (0~1)
        this.RGB_STEP = RGB_STEP; // RGBの変化ステップ
        this.RGB_DEFAULT = RGB_DEFAULT; // RGBの初期値（金色）
        // 表示関連
        this.funcType = 1;  // 関数タイプ 初期値: Gaussian
        this.isPaused = false;  //アニメーション一時停止
        this.showScaleHUD = true;  // スケールHUD表示
        this.showAbs = true;  // |F(ω)|表示
        this.showRe = true;  // Re(F(ω))表示
        this.showIm = true;  // Im(F(ω))表示
        // 複素平面スケール関連
        this.rMaxVisual = 1e-6; // 複素平面の表示上の最大半径（動的に変化）
        this.rMaxTarget = 1e-6; // 複素平面の目標最大半径（動的に変化）
        // 色相
        this.hue = 0;
        // 配列
        this.ft = new Array(this.N_SAMPLES);
        this.ts = new Array(this.N_SAMPLES);
        this.dt = (this.T_MAX - this.T_MIN) / (this.N_SAMPLES - 1); // 積分の微小区間幅
        this.path = [];         // 複素平面上の積分の様子を描くための点列
        this.spectrum = [];     // 記録: {w, Re, Im, Abs}

        // 速度関連
        this.speed = SPEED_DEFAULT;  // フレームごとのωステップ係数
        this.wMax = W_MAX_DEFAULT;  // ωの最大値[-wMax,wMax]
        this.wCurrent = -this.wMax; // 現在のω
        // カスタム式
        this.CUSTOM_EXPR = CUSTOM_EXPR; // カスタム関数の式
        // tとf(t)の事前計算
        for (let i = 0; i < this.N_SAMPLES; i++) {
            const t = this.T_MIN + i * this.dt;
            this.ts[i] = t;
            this.ft[i] = this.f_of_t(t);
        }

    }
    f_of_t = (t) => {
        switch (this.funcType) {
            case 1: // Gaussian
                return Math.exp(-0.5 * (t / 1.5) ** 2);
            case 2: // Step (rect)
                return (Math.abs(t) <= 2.0) ? 1 : 0;
            case 3: // Triangle
                {
                    const a = 3.0; // 幅
                    return Math.max(0, 1 - Math.abs(t) / a); t;
                }
            case 4: // Sine
                return Math.sin(2 * Math.PI * t / 4);
            case 5: // Sawtooth (odd symmetry)
                {
                    const T = 4.0;
                    const xx = ((t % T) + T) % T; // [0,T)
                    return (2 * xx / T - 1);
                }
            case 6: // Custom expression in terms of x
                return Math.cos(2 * Math.PI * t / 4) + Math.sin(t);
            default:
                return 0;
        }
    }


    recomputeFt = () => {
        // f(t)の再計算(関数タイプ変更時)
        for (let i = 0; i < this.N_SAMPLES; i++) {
            this.ft[i] = this.f_of_t(this.ts[i]);
        }
    }
    resetTransform = () => {
        this.spectrum = [];
        this.wCurrent = -this.wMax;
        this.isPaused = false;
    }

    setSpectrum = () => {
        let curRe = 0, curIm = 0;
        this.path = [];
        for (let i = 0; i < this.N_SAMPLES; i++) {
            const t = this.ts[i];
            const f = this.ft[i];
            const phi = -this.wCurrent * t; // e^{-jωt}
            const cRe = Math.cos(phi);
            const cIm = Math.sin(phi);
            // 積分を総和で近似してるが、両端だけ半分の重み（0.5） を与えて、端点の寄与を正しくする
            const weight = (i === 0 || i === this.N_SAMPLES - 1) ? 0.5 : 1.0;
            curRe += f * cRe * weight * this.dt;
            curIm += f * cIm * weight * this.dt;
            this.path.push([curRe, curIm]);
        }
        const curAbs = Math.hypot(curRe, curIm);
        this.spectrum.push({ w: this.wCurrent, Re: curRe, Im: curIm, Abs: curAbs });
    }

    // f(t)のプロット
    plotFt = (w, h) => {
        // 軸
        push();
        stroke(128); // 軸の色
        line(this.PAD_COMMON * 0.5, h - this.PAD_COMMON, w - this.PAD_COMMON, h - this.PAD_COMMON); // x軸の描画 (x1, y, x2, y)
        line(this.PAD_COMMON, this.PAD_COMMON * 2.5, this.PAD_COMMON, h - this.PAD_COMMON * 0.5); // x軸の描画 (x1, y, x2, y)); // y軸の描画 (x, y1, x, y2)
        // ラベル
        noStroke();
        fill(160); // ラベルの色
        textSize(11); // ラベルの文字サイズ
        text('x', w - this.PAD_COMMON + 4, h - this.PAD_COMMON + 4);
        text('f(x)', this.PAD_COMMON * 0.5, this.PAD_COMMON * 2);
        // 0ライン
        const x0 = this.PAD_COMMON;
        const x1 = w - this.PAD_COMMON;
        const y0 = h - this.PAD_COMMON;
        const y1 = this.PAD_COMMON * 2.5;
        const yc = (h + this.PAD_COMMON * 1.5) / 2;
        stroke(192, 192, 192, 128);
        line(x0, yc, x1, yc);

        // スケール
        const sx = (x1 - x0) / (this.T_MAX - this.T_MIN);
        const sy = (y0 - y1) * 0.45; // スケール
        // 曲線
        noFill();
        stroke(this.RGB_DEFAULT[0], this.RGB_DEFAULT[1], this.RGB_DEFAULT[2]); // 曲線の色 (R,G,B)
        beginShape(); // 線分の開始
        for (let i = 0; i < this.N_SAMPLES; i++) {
            const x = this.ts[i];
            const y = this.ft[i];
            const px = x0 + (x - this.T_MIN) * sx;
            const py = yc - y * sy;
            vertex(px, py);
        }
        endShape(); // 線分の終了
        // 目盛り
        stroke(192, 192, 192, 64);
        for (let k = this.T_MIN + 1; k <= this.T_MAX; k++) {
            const px = x0 + (k - this.T_MIN) * sx;
            if (k == 0) {
                stroke(192, 192, 192, 128);
            } else {
                stroke(192, 192, 192, 64);
            }
            line(px, y1, px, y0 + this.PAD_COMMON * 0.5);
        }
        pop();
    }
    // 複素平面での積分の様子
    plotComplexPath = (w, h) => {
        this.setSpectrum(); // スペクトル計算
        const x0 = this.PAD_COMMON;
        const x1 = w - this.PAD_COMMON;
        const y0 = h - this.PAD_COMMON;
        const y1 = this.PAD_COMMON * 1.5;
        const xc = (x0 + x1) / 2;
        const yc = (y0 + y1) / 2;
        // スケールは動的（パスの広がりに合わせる）: アニメーションごとに変わる自動スムージング
        this.rMaxTarget = 1e-6;
        for (const [xr, xi] of this.path) { this.rMaxTarget = Math.max(this.rMaxTarget, Math.hypot(xr, xi)); } // パスの最大半径を求める
        // スケールの初期化
        if (frameCount <= 2 && this.rMaxVisual < 1e-5) {
            this.rMaxVisual = this.rMaxTarget;
        }
        // 表示スケール更新
        this.rMaxVisual += (this.rMaxTarget - this.rMaxVisual) * this.SCALE_SMOOTH_K; // 平滑化
        this.rMaxVisual = Math.max(this.rMaxVisual, 1e-6); // 0防止
        const scaleSmooth = 0.85 * Math.min(x1 - x0, y0 - y1) / 2 / this.rMaxVisual; // 最大半径が画面の85%に収まるように

        // 軸
        push();
        stroke(128); // 軸の色
        line(x0, yc, x1, yc); // Re軸の描画
        line(xc, y1, xc, y0); // Im軸の描画
        // ラベル
        noStroke();
        fill(160);
        textSize(11);
        text('Re', x1 - this.PAD_COMMON, yc - this.PAD_COMMON * 0.5);
        text('Im', xc + this.PAD_COMMON * 0.5, y1 + this.PAD_COMMON * 0.5);

        // スケールHUD
        if (this.showScaleHUD) {
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
            text(`scale 1unit = ${scaleSmooth.toFixed(0)}px, α=${this.SCALE_SMOOTH_K.toFixed(2)}`,
                x0 + 8, y0 - 8);
        }

        // パス
        colorMode(HSB, 360, 100, 100); // 色相環で色を変化させる設定
        if (!this.isPaused) {
            this.hue = (frameCount * 2) % 360; // 色相を変化させる
        }
        stroke(this.hue, 100, 100);
        noFill();
        beginShape();
        for (const [xr, xi] of this.path) {
            const px = xc + xr * scaleSmooth;
            const py = yc - xi * scaleSmooth;
            vertex(px, py);
        }
        endShape();
        colorMode(RGB, 255); // 元に戻す

        // 末端ベクトル: 最終的に計算されるF(ω)
        const [xr, xi] = this.path[this.path.length - 1];
        const px = xc + xr * scaleSmooth;
        const py = yc - xi * scaleSmooth;
        fill(this.RGB_DEFAULT);
        noStroke();
        circle(px, py, 10);
        pop();
    }

    // 周波数領域のプロット（|F(ω)|, Re, Im）
    plotSpectrum = (w, h) => {
        // 座標の位置
        const x0 = this.PAD_COMMON;
        const x1 = w - this.PAD_COMMON * 5;
        const y0 = h - this.PAD_COMMON;
        const y1 = this.PAD_COMMON * 1.5;
        // -wMAX ~ +wMAX を x0 ~ x1 にマッピングする関数
        const sx = (x1 - x0) / (2 * this.wMax); // 1ラジアンあたり何ピクセル動かすか
        const wToX = (wv) => { return x0 + (wv + this.wMax) * sx; };
        const xw = wToX(this.wCurrent); // 現在のωの位置: x座標
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
        text('ω', x1 - this.PAD_COMMON, yc - this.PAD_COMMON * 0.5);
        text('|F(ω)|', x0 + this.PAD_COMMON * 0.5, y1 + this.PAD_COMMON);


        // 縦スケール（動的）
        let yMax = 1e-6;
        // グラフ全体で縦の最大値を求める
        for (const s of this.spectrum) {
            yMax = Math.max(yMax, Math.abs(s.Abs), Math.abs(s.Re), Math.abs(s.Im));
        }
        const sy = (y0 - y1) / (2.2 * yMax); //

        // |F(ω)|
        noFill();
        if (this.showAbs) {
            stroke(this.RGB_DEFAULT[0], this.RGB_DEFAULT[1], this.RGB_DEFAULT[2], 192); // 曲線の色 (R,G,B)
            strokeWeight(3); // 線の太さ
            beginShape();
            // 毎回、最初からすべて書き直してる
            for (const s of this.spectrum) {
                vertex(wToX(s.w), yc - s.Abs * sy);
            }
            endShape();
        }
        // Re
        if (this.showRe) {
            stroke(255, 0, 0, 192);
            strokeWeight(3); // 線の太さ
            beginShape();
            // 毎回、最初からすべて書き直してる
            for (const s of this.spectrum) {
                vertex(wToX(s.w), yc - s.Re * sy);
            }
            endShape();
        }
        // Im
        if (this.showIm) {
            stroke(0, 0, 255, 192);
            strokeWeight(3); // 線の太さ
            beginShape();
            // 毎回、最初からすべて書き直してる
            for (const s of this.spectrum) {
                vertex(wToX(s.w), yc - s.Im * sy);

            }
            endShape();
        }

        // 現在位置までを塗りつぶす
        colorMode(HSB, 360, 100, 100); // 色相環で色を変化させる設定
        if (!this.isPaused) {
            this.hue = (frameCount * 2) % 360; // 色相を変化させる
        }
        noStroke();
        fill(this.hue, 100, 100, 0.2);
        rect(x0, y1, xw - x0, y0 - y1);
        colorMode(RGB, 255); // 元に戻す

        // 周波数を数値表示
        noStroke();
        fill(255);
        textSize(24);
        text(`${(this.wCurrent / (2 * Math.PI)).toFixed(1)}Hz`, xw + 10, y1 + 80);
        // 終了処理
        pop();
    }
}