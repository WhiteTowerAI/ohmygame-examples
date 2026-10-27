import { mountCutscene } from "../../shared/story/cutscene.js";

export function mount(context) {
  return mountCutscene(context, {"hud": "身后", "beats": [{"speaker": "年轻男人", "text": "我不是……让你别上来吗？"}, {"text": "同一句话，同时从听筒里、和身后座位附近传来。"}, {"text": "她的表情停住，慢慢回头。"}, {"text": "后排坐着一个年轻男人，举着手机。他的头发和衣服全湿了，水从袖口滴到地板上。嘴唇始终没有动。"}, {"speaker": "年轻男人", "text": "现在下不去了。"}], "signal": "next"});
}
