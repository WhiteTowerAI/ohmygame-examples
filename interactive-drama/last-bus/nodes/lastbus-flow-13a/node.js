import { mountCutscene } from "../../shared/story/cutscene.js";
import { runQte } from "../../shared/story/qte.js";

export function mount(context) {
  let active = () => {};
  active = mountCutscene(context, {
    hud: "连打停车铃",
    beats: [{"text": "她猛地起身，看向前方。"}, {"text": "挡风玻璃外，车灯照亮湿滑的路面，也照出越来越近的桥边护栏。"}, {"text": "车没有减速。"}, {"text": "她经过同排空着的座位，伸手去够黄色立柱上的停车铃。"}],
    onDone: () => {
      active = runQte(context, {"prompt": "3 秒内快速点击停车铃 5 次", "required": 5, "duration": 3000, "successSignal": "success", "failSignal": "timeout"});
    },
  });
  return () => active();
}
