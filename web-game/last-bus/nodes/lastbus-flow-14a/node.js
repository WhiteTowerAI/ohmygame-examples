import { mountEnding } from "../../shared/story/ending.js";

export function mount(context) {
  return mountEnding(context, {
    eyebrow: "结局一",
    title: "末班乘客",
    seal: "末",
    body: "今晚，车上多了一个人。",
    actionLabel: "回到车来之前",
    signal: "retry",
  });
}
