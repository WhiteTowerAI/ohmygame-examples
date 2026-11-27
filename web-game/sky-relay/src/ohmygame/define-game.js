/* @ohmygame/game-sdk 0.0.1 */
function defineGame(definition) {
  return definition;
}
function defineRealtimeGame(definition) {
  return definition;
}
function isRealtimeGameDefinition(value) {
  return typeof value === "object" && value !== null && typeof value.tick === "function";
}
export {
  defineGame,
  defineRealtimeGame,
  isRealtimeGameDefinition
};
