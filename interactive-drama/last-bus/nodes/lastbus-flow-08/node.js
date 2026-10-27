import { mountHotspots } from "../../shared/story/hotspots.js";

export function mount(context) {
  return mountHotspots(context, {"hud": "上车前", "prompt": "车门开着，阿姨已经在里面等你。你可以再确认一次。", "hotspots": [{"id": "front", "label": "车头", "x": 74, "y": 34, "signal": "front"}, {"id": "cabin", "label": "车厢", "x": 48, "y": 54, "signal": "cabin"}, {"id": "phone", "label": "手机", "x": 18, "y": 72, "signal": "phone"}], "continueLabel": "该决定了", "continueSignal": "next"});
}
