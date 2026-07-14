// ─────────────────────────────────────────────────────────────
// 차트 보조지표 계산 (프레임워크 무관 순수 함수)
//  - sma: 단순 이동평균선
//  - ichimoku: 일목균형표 (전환선 9 / 기준선 26 / 선행스팬 26칸 앞 / 후행스팬 26칸 뒤)
// 시간값(t)은 초 단위 숫자로 계산하고, 화면 표시용 변환은 호출하는 쪽에서 한다.
// ─────────────────────────────────────────────────────────────

// 단순 이동평균: 종가 기준. period개가 모인 시점부터 값이 나온다.
export function sma(candles, period) {
  const out = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    if (i >= period - 1) out.push({ t: candles[i].time, value: sum / period });
  }
  return out;
}

// period 구간의 (최고가 + 최저가) / 2
function midpoint(candles, i, period) {
  let hi = -Infinity;
  let lo = Infinity;
  for (let j = i - period + 1; j <= i; j++) {
    if (candles[j].high > hi) hi = candles[j].high;
    if (candles[j].low < lo) lo = candles[j].low;
  }
  return (hi + lo) / 2;
}

// 일목균형표. dt = 봉 간격(초) — 마지막 봉 이후의 미래 시간칸(선행스팬용)을 만들 때 사용.
export function ichimoku(candles, dt) {
  const n = candles.length;
  const t = (i) => (i < n ? candles[i].time : candles[n - 1].time + (i - (n - 1)) * dt);

  const tenkan = []; // 전환선 (9)
  const kijun = []; // 기준선 (26)
  const chikou = []; // 후행스팬 (종가를 26칸 뒤로)
  const cloud = []; // 구름대: 같은 시간칸의 선행스팬1·2 쌍 (26칸 앞으로)

  const tenkanAt = new Array(n).fill(null);
  const kijunAt = new Array(n).fill(null);

  for (let i = 0; i < n; i++) {
    if (i >= 8) {
      tenkanAt[i] = midpoint(candles, i, 9);
      tenkan.push({ t: t(i), value: tenkanAt[i] });
    }
    if (i >= 25) {
      kijunAt[i] = midpoint(candles, i, 26);
      kijun.push({ t: t(i), value: kijunAt[i] });
    }
    if (i >= 26) chikou.push({ t: t(i - 26), value: candles[i].close });
  }

  // 선행스팬1 = (전환+기준)/2, 선행스팬2 = 52구간 중간값 — 둘 다 26칸 앞에 그림
  for (let i = 51; i < n; i++) {
    cloud.push({
      t: t(i + 26),
      a: (tenkanAt[i] + kijunAt[i]) / 2,
      b: midpoint(candles, i, 52),
    });
  }

  return { tenkan, kijun, chikou, cloud };
}

// ─────────────────────────────────────────────────────────────
// 구름대 채우기: lightweight-charts v4의 series primitive로
// 선행스팬1·2 사이를 반투명하게 칠한다 (양운=초록, 음운=빨강).
// 사용: series.attachPrimitive(new CloudPrimitive(points))
//  points: [{ time(차트 시간형식), a, b }]
// ─────────────────────────────────────────────────────────────
export class CloudPrimitive {
  constructor(points, colors = {}) {
    this._points = points;
    this._up = colors.up || 'rgba(46, 194, 110, 0.13)';
    this._down = colors.down || 'rgba(246, 70, 93, 0.13)';
    this._chart = null;
    this._series = null;

    const self = this;
    this._paneView = {
      zOrder: () => 'bottom', // 구름은 봉·선 뒤에 깔리게
      renderer: () => ({
        draw: (target) => {
          target.useMediaCoordinateSpace(({ context: ctx }) => self._draw(ctx));
        },
      }),
    };
  }

  attached({ chart, series }) {
    this._chart = chart;
    this._series = series;
  }

  detached() {
    this._chart = null;
    this._series = null;
  }

  paneViews() {
    return [this._paneView];
  }

  _draw(ctx) {
    if (!this._chart || !this._series || this._points.length < 2) return;
    const timeScale = this._chart.timeScale();

    // 화면 좌표로 변환 (보이지 않는 구간은 null)
    const coords = this._points.map((p) => {
      const x = timeScale.timeToCoordinate(p.time);
      const aY = this._series.priceToCoordinate(p.a);
      const bY = this._series.priceToCoordinate(p.b);
      return x === null || aY === null || bY === null ? null : { x, aY, bY, up: p.a >= p.b };
    });

    // 인접한 두 점 사이를 사다리꼴로 채움
    for (let i = 0; i < coords.length - 1; i++) {
      const c1 = coords[i];
      const c2 = coords[i + 1];
      if (!c1 || !c2) continue;
      ctx.fillStyle = c1.up && c2.up ? this._up : !c1.up && !c2.up ? this._down : this._up;
      ctx.beginPath();
      ctx.moveTo(c1.x, c1.aY);
      ctx.lineTo(c2.x, c2.aY);
      ctx.lineTo(c2.x, c2.bY);
      ctx.lineTo(c1.x, c1.bY);
      ctx.closePath();
      ctx.fill();
    }
  }
}
