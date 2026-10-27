import { mountCutscene } from "../../shared/story/cutscene.js";
import { markSeen } from "../../shared/story/progress.js";

export function mount(context) {
  markSeen(context, "phone");
  return mountCutscene(context, {
    hud: "手机",
    beats: [{"text": "打车软件仍显示「正在寻找司机……」"}, {"text": "通话记录里，那个陌生号码还在。"}],
    onDone: (ctx) => { ctx.navigation.back(); },
  });
}
