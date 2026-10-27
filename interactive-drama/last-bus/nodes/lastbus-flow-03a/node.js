import { mountCutscene } from "../../shared/story/cutscene.js";

export function mount(context) {
  context.state.set("calledBack", true);
  return mountCutscene(context, {"hud": "回拨", "beats": [{"text": "她按下了回拨。响了很多声。"}, {"text": "没有人说话，听筒里只有车厢低频的震动。"}, {"speaker": "报站声", "text": "下一站，南桥。"}, {"speaker": "女生", "text": "喂？你好？"}, {"text": "通话结束了。她把手机拿远了一点。"}], "signal": "next"});
}
