import { addStatusEffectChange } from "../effects.js";
import { baseSpellEffect } from "../specialSpells.js";

export function crownofMadnessEffect(document) {
  let effect = baseSpellEffect(document, document.name);
  addStatusEffectChange(effect, "Charmed", 20, true);
  effect.changes.push({
    key: "flags.midi-qol.OverTime",
    mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE,
    value: "label=Crown of Madness (End of Turn),turn=end,saveDC=@attributes.spelldc,saveAbility=wis,saveMagic=true,killAnim=true",
    priority: "20",
  });
  document.effects.push(effect);

  return document;
}
