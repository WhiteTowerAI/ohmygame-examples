import { mountCutscene } from "../../shared/story/cutscene.js";

export function mount(context) {
  return mountCutscene(context, {"hud": "第五场 · 留在灯下", "beats": [{"speaker": "阿姨", "text": "小姑娘，那你注意安全哦，早点回家。"}, {"text": "车门关上，公交缓缓经过女生面前。"}, {"text": "手机突然震动。屏幕上，是刚才那个陌生号码。"}, {"text": "后排车窗里，一个湿透的年轻男人举着手机，正看着她。他轻轻点了一下头。"}, {"text": "她没有接听。来电停止。车辆消失在路口，发动机声也突然中断。"}, {"text": "她站了片刻，转身拿起雨伞，走向旁边亮着灯的便利店。"}], "signal": "next"});
}
