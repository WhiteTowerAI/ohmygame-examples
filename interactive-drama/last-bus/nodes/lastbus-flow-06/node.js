import { mountCutscene } from "../../shared/story/cutscene.js";

export function mount(context) {
  return mountCutscene(context, {"hud": "继续等车", "beats": [{"text": "远处出现车灯，在雨里慢慢靠近。"}, {"speaker": "阿姨", "text": "来了来了。"}, {"text": "阿姨站起来，提起布袋。"}], "signal": "next"});
}
