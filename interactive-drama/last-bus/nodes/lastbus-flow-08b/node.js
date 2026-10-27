import { mountCutscene } from "../../shared/story/cutscene.js";
import { markSeen } from "../../shared/story/progress.js";

export function mount(context) {
  markSeen(context, "cabin");
  return mountCutscene(context, {
    hud: "车厢",
    beats: [{"text": "普通座椅，暖色灯光，车辆正常运行。"}, {"text": "阿姨已经在后排靠窗坐好了。"}],
    onDone: (ctx) => { ctx.navigation.back(); },
  });
}
