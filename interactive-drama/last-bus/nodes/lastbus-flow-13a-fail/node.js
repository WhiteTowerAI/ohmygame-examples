import { mountCutscene } from "../../shared/story/cutscene.js";

export function mount(context) {
  return mountCutscene(context, {"hud": "超时", "beats": [{"text": "车身一晃，她的手错过了按钮，扶住椅背。"}, {"speaker": "女生", "text": "师傅，停车！"}, {"text": "没有铃声。司机没有回应。"}], "signal": "next"});
}
