import { mountCutscene } from "../../shared/story/cutscene.js";

export function mount(context) {
  return mountCutscene(context, {"hud": "第四场 · 车门", "beats": [{"text": "17路驶入画面，停在站前。正常的刹车声、排气声。"}, {"text": "车厢亮着暖黄色灯光，前排座位空着，后半截被座椅靠背挡住。"}, {"speaker": "司机", "text": "今天最后一趟车了啊。"}, {"text": "阿姨先上车，投币。她走到后排靠窗坐下，把布袋放在腿上。"}, {"speaker": "阿姨", "text": "小姑娘，快上车呀。"}], "signal": "next"});
}
