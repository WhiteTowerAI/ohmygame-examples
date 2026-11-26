import { mountCutscene } from "../../shared/story/cutscene.js";

export function mount(context) {
  return mountCutscene(context, {"hud": "第三场 · 阿姨", "beats": [{"text": "一把伞进入画面。阿姨走进候车亭，收伞，把布袋放在脚边。"}, {"speaker": "阿姨", "text": "小姑娘，几点了，十七路过去没有？"}, {"speaker": "女生", "text": "现在是零点十七。"}, {"speaker": "阿姨", "text": "还好还好，来得及。零点发的车，到这儿差不多二十。一下夜班就下雨，紧赶慢赶的。"}, {"speaker": "女生", "text": "是啊，本来想打车，叫了半天，没人接。"}, {"speaker": "阿姨", "text": "坐公交也快。你到哪儿？"}, {"speaker": "女生", "text": "南桥。"}, {"speaker": "阿姨", "text": "那就一站路，过了桥就到了。快到了提前按铃——我姑娘头一回坐，坐过站，一路坐到终点。"}, {"speaker": "女生", "text": "嗯，谢谢阿姨。"}, {"speaker": "阿姨", "text": "客气啥，这趟我熟。"}], "signal": "next"});
}
