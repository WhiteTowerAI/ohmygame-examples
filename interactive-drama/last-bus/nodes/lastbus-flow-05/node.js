import { mountHotspots } from "../../shared/story/hotspots.js";

export function mount(context) {
  return mountHotspots(context, {"hud": "自由观察", "prompt": "雨点敲着顶棚。你可以看看站牌，或者和阿姨聊聊。", "hotspots": [{"id": "notice", "label": "站牌", "x": 5, "y": 46, "signal": "notice"}, {"id": "aunt", "label": "阿姨", "x": 33, "y": 60, "signal": "talk"}], "continueLabel": "继续等车", "continueSignal": "next"});
}
