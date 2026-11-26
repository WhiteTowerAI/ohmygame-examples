import { mountCutscene } from "../../shared/story/cutscene.js";

export function mount(context) {
  return mountCutscene(context, {"hud": "成功", "beats": [{"text": "她按下了车铃。叮——"}, {"speaker": "女生", "text": "师傅，停车！"}, {"text": "司机没有回应。车辆仍未减速。"}], "signal": "next"});
}
