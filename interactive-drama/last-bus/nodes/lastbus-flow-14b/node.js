import { mountEnding } from "../../shared/story/ending.js";

export function mount(context) {
  return mountEnding(context, {
    eyebrow: "结局二",
    title: "留在灯下",
    seal: "灯",
    body: "今晚，你没有坐上那辆车。",
    actionLabel: "重新体验",
    onAction: (ctx) => {
      ctx.state.patch({ calledBack: false, heardNotice: false, investigated: [] });
      void ctx.navigation.emit("restart");
    },
  });
}
