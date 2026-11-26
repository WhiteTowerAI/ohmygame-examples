import { mountCutscene } from "../../shared/story/cutscene.js";
import { markSeen } from "../../shared/story/progress.js";

export function mount(context) {
  markSeen(context, "aunt");
  return mountCutscene(context, {
    hud: "阿姨",
    beats: [{"speaker": "女生", "text": "您在哪儿下？"}, {"speaker": "阿姨", "text": "终点下。"}, {"text": "她把脚边的布袋往里收了一点。"}, {"speaker": "阿姨", "text": "你到家早。"}],
    onDone: (ctx) => { ctx.navigation.back(); },
  });
}
