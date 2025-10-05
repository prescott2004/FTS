// 表示領域制限
export const clipRect = (x, y, w, h) => {
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.rect(x, y, w, h);
    drawingContext.clip();
    translate(x, y);
};

// 表示制限解除
export const noClip = () => { drawingContext.restore(); };

// 枠とタイトル
export const drawBox = (w, h, title) => {
    // 枠
    stroke(255, 255, 255); // 枠の色 (R,G,B)
    noFill(); // 塗りつぶしなし
    rect(0, 0, w, h, 10); // 角丸四角形(x, y, w, h, r) x,yは左上
    // タイトル
    noStroke(); // 枠線なし
    fill(255); // 文字色 (R,G,B)
    textSize(12); // 文字サイズ
    text(title, 10, 16); // 位置(x, y) yはベースライン
};

