import { mountCutscene } from "../../shared/story/cutscene.js";

export function mount(context) {
  const called = context.state.get("calledBack") === true;
  return mountCutscene(context, {
    hud: "车内来电",
    beats: called
      ? [
          { text: "她接听起来。听筒里先响起——" },
          { speaker: "报站声", text: "下一站，南桥。" },
          { text: "她认出了这个声音，握紧了手机。" },
        ]
      : [
          { text: "听筒里只有车厢的低频震动。" },
        ],
    signal: "next",
  });
}
