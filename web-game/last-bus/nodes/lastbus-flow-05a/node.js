import { mountCutscene } from "../../shared/story/cutscene.js";
import { markSeen } from "../../shared/story/progress.js";

export function mount(context) {
  markSeen(context, "notice");
  context.state.set("heardNotice", true);
  return mountCutscene(context, {
    hud: "站牌",
    beats: [{"text": "站牌下有一张被雨泡皱的通知，一角被翘起的旧广告压住。"}, {"text": "17路夜间班次临时停运通知"}, {"text": "因车辆事故，夜间班次暂停运营，恢复时间另行通知。日间班次正常运行。"}, {"speaker": "女生", "text": "诶，阿姨，这写着夜里停了。"}, {"speaker": "阿姨", "text": "啊？不会吧？我昨天晚上还坐呢。是旧通知吧？"}, {"speaker": "女生", "text": "……是吗？"}, {"speaker": "阿姨", "text": "如果停了，白天过来的时候司机师傅应该会提醒我的。"}, {"text": "她继续看向路口，表情没有任何异常。"}],
    onDone: (ctx) => { ctx.navigation.back(); },
  });
}
