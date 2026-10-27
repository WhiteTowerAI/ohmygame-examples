import { mountChoice } from "../../shared/story/choice.js";

export function mount(context) {
  return mountChoice(context, {"hud": "第二场 · 陌生电话", "prompt": "通话记录里，是刚才那个陌生号码。", "options": [{"label": "回拨", "signal": "callback"}, {"label": "收起手机", "signal": "skip"}]});
}
