import { mountCutscene } from "../../shared/story/cutscene.js";

export function mount(context) {
  return mountCutscene(context, {"hud": "第五场 · 末班乘客", "beats": [{"text": "她上了车，刷手机支付。滴。"}, {"text": "她往后走，坐在阿姨后面一排。"}, {"text": "车门合拢。站台的雨声骤然变闷，只剩车厢里的低频震动。"}, {"text": "公交驶离站台，窗外的灯光缓缓掠过她的脸。"}, {"text": "手机震动。还是那个号码。她接听起来。"}, {"speaker": "女生", "text": "喂？"}], "signal": "next"});
}
