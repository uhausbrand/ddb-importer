import { addStatusEffectChange } from "../effects.js";
import { baseSpellEffect } from "../specialSpells.js";

export function geasEffect(document) {
  let effect = baseSpellEffect(document, document.name);
  addStatusEffectChange(effect, "Charmed", 20, true);
  document.effects.push(effect);

  return document;
}
