import { mountSwipe } from "../../shared/story/swipe.js";
import { mountCutscene } from "../../shared/story/cutscene.js";

export function mount(context) {
  let active = () => {};
  active = mountSwipe(context, {
    label: "滑动接听",
    onDone: () => {
      active = mountCutscene(context, {"hud": "第二场 · 陌生电话", "beats": [{"text": "接通了。听筒里先传来模糊的车辆行驶声。"}, {"speaker": "年轻男人", "text": "下一辆车，别上车。"}, {"speaker": "女生", "text": "什么？"}, {"text": "电话挂断了。"}, {"speaker": "女生", "text": "……恶作剧吧。"}], "signal": "next"});
    },
  });
  return () => active();
}
