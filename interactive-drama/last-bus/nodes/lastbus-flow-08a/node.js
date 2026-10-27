import { mountCutscene } from "../../shared/story/cutscene.js";
import { markSeen } from "../../shared/story/progress.js";

export function mount(context) {
  markSeen(context, "front");
  return mountCutscene(context, {
    hud: "车头",
    beats: [{"text": "车头显示：17路。和站牌上的一致。"}, {"text": "仅此而已。"}],
    onDone: (ctx) => { ctx.navigation.back(); },
  });
}
