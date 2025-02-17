import utils from "../../../lib/utils.js";
import logger from "../../../logger.js";


export default class DDBMonsterFeatureActivity {

  _init() {
    logger.debug(`Generating DDBMonsterFeatureActivity ${this.name ?? ""} for ${this.actor.name}`);
  }

  _generateDataStub() {

    const rawStub = new this.activityType.documentClass({
      name: this.name,
      type: this.type,
    });

    this.data = rawStub.toObject();
    this.data._id = utils.namedIDStub(this.name ?? this.feature.name ?? this.type, {
      prefix: this.nameIdPrefix,
      postfix: this.nameIdPostfix,
    });
  }


  constructor({ type, name, ddbParent, nameIdPrefix = null, nameIdPostfix = null } = {}) {

    this.type = type.toLowerCase();
    this.activityType = CONFIG.DND5E.activityTypes[this.type];
    if (!this.activityType) {
      throw new Error(`Unknown Activity Type: ${this.type}, valid types are: ${Object.keys(CONFIG.DND5E.activityTypes)}`);
    }
    this.name = name;
    this.ddbParent = ddbParent;
    this.feature = ddbParent.feature;
    this.actor = ddbParent.ddbMonster.npc;
    this.actionInfo = ddbParent.actionInfo;

    this.nameIdPrefix = nameIdPrefix ?? "act";
    this.nameIdPostfix = nameIdPostfix ?? "";

    this._init();
    this._generateDataStub();

  }

  _generateActivation() {
    this.data.activation = this.actionInfo.activation;
  }

  _generateConsumption() {
    let targets = [];
    let scaling = false;

    // types:
    // "attribute"
    // "hitDice"
    // "material"
    // "itemUses"

    if (this.actionInfo.consumptionTargets?.length > 0) {
      targets = this.actionInfo.consumptionTargets;
    } else if (this.actionInfo.consumptionValue) {
      targets.push({
        type: "itemUses",
        target: "",
        value: this.actionInfo.consumptionValue,
        scaling: {
          mode: "",
          formula: "",
        },
      });
    }

    this.data.consumption = {
      targets,
      scaling: {
        allowed: scaling,
        max: "",
      },
    };

  }

  _generateDescription() {
    this.data.description = {
      chatFlavor: this.feature.system?.chatFlavor ?? "",
    };
  }

  _generateDuration() {
    this.data.duration = this.actionInfo.duration;
  }

  _generateEffects() {
    logger.debug(`Stubbed effect generation for ${this.name}`);
    // Enchantments need effects here
  }

  _generateRange() {
    this.data.range = this.actionInfo.range;
  }

  _generateTarget() {
    this.data.target = this.actionInfo.target;
  }

  _getFeaturePartsDamage() {
    let baseParts = this.ddbParent.templateType === "weapon"
      ? this.actionInfo.damageParts.slice(1)
      : this.actionInfo.damageParts;

    return baseParts;
  }

  _generateDamage({ parts = [], includeBase = true } = {}) {
    const companion = foundry.utils.getProperty(this.ddbParent.ddbMonster, "npc.flags.ddbimporter.entityTypeId") === "companion-feature";

    let damageParts = parts.length > 0
      ? parts
      : this._getFeaturePartsDamage().map((data) => data.part);

    if (companion) {
      damageParts = damageParts.map((data) => {
        data.bonus = data.bonus.replace("@prof", "");
        return data;
      });
    }

    this.data.damage = {
      includeBase,
      parts: damageParts,
    };

    // damage: {
    //   critical: {
    //     allow: false,
    //     bonus: source.system.critical?.damage
    //   },
    //   onSave: (source.type === "spell") && (source.system.level === 0) ? "none" : "half",
    //   includeBase: true,
    //   parts: damageParts.map(part => this.transformDamagePartData(source, part)) ?? []
    // }
  }

  _generateHealing({ part = null } = {}) {
    const healing = part
      ? part
      : this.actionInfo.healingParts.length > 0
        ? this.actionInfo.healingParts.map((data) => data.part)[0]
        : undefined;
    this.data.healing = healing;
  }

  _generateSave() {
    this.data.save = this.actionInfo.save;
  }


  _generateAttack() {
    let classification = this.ddbParent.spellAttack
      ? "spell"
      : "weapon"; // unarmed, weapon, spell

    let type = this.ddbParent.rangedAttack
      ? "ranged"
      : "melee";

    const attack = {
      ability: this.actionInfo.baseAbility,
      bonus: this.actionInfo.extraAttackBonus && `${this.actionInfo.extraAttackBonus}`.trim() !== "0" ? `${this.actionInfo.extraAttackBonus}` : "",
      critical: {
        threshold: undefined,
      },
      flat: false, // almost never false for PC features
      type: {
        value: type,
        classification,
      },
    };

    this.data.attack = attack;

  }

  _generateCheck({ checkOverride = null }) {
    this.data.check = checkOverride ?? {
      associated: this.actionInfo.associatedToolsOrAbilities,
      ability: this.actionInfo.ability,
      dc: {},
    };
  }

  build({
    damageParts = [],
    healingPart = null,
    generateActivation = true,
    generateAttack = false,
    generateConsumption = true,
    generateCheck = false,
    generateDamage = false,
    generateDescription = false,
    generateDuration = true,
    generateEffects = true,
    generateHealing = false,
    generateRange = true,
    generateSave = false,
    generateTarget = true,
    includeBaseDamage = true,
    checkOverride = null,
  } = {}) {

    // override set to false on object if overriding

    logger.debug(`Generating Activity for ${this.ddbParent.name}`, {
      damageParts,
      healingPart,
      generateActivation,
      generateAttack,
      generateConsumption,
      generateDamage,
      generateDescription,
      generateDuration,
      generateEffects,
      generateHealing,
      generateRange,
      generateSave,
      generateTarget,
      includeBaseDamage,
      generateCheck,
      checkOverride,
      this: this,
    });

    if (generateActivation) this._generateActivation();
    if (generateAttack) this._generateAttack();
    if (generateConsumption) this._generateConsumption();
    if (generateDescription) this._generateDescription();
    if (generateDuration) this._generateDuration();
    if (generateEffects) this._generateEffects();
    if (generateRange) this._generateRange();
    if (generateTarget) this._generateTarget();

    if (generateSave) this._generateSave();
    if (generateDamage) this._generateDamage({ parts: damageParts, includeBase: includeBaseDamage });
    if (generateHealing) this._generateHealing({ part: healingPart });

    if (generateCheck) this._generateCheck({ checkOverride });


    // ATTACK has
    // activation
    // attack
    // consumption
    // damage
    // description
    // duration
    // effects
    // range
    // target
    // type
    // uses

    // DAMAGE
    // activation
    // consumption
    // damage
    // description
    // duration
    // effects
    // range
    // target
    // type
    // uses


    // ENCHANT:
    // DAMAGE + enchant

    // HEAL
    // activation
    // consumption
    // healing
    // description
    // duration
    // effects
    // range
    // target
    // type
    // uses

    // SAVE
    // activation
    // consumption
    // damage
    // description
    // duration
    // effects
    // range
    // save
    // target
    // type
    // uses

    // SUMMON
    // activation
    // bonuses
    // consumption
    // creatureSizes
    // creatureTypes
    // description
    // duration
    // match
    // profles
    // range
    // summon
    // target
    // type
    // uses

    // UTILITY
    // activation
    // consumption
    // description
    // duration
    // effects
    // range
    // roll - name, formula, prompt, visible
    // target
    // type
    // uses


  }

  static createActivity({ document, type, name, character } = {}, options = {}) {
    const activity = new DDBMonsterFeatureActivity({
      name: name ?? null,
      type,
      foundryFeature: document,
      actor: character,
    });

    activity.build(options);
    foundry.utils.setProperty(document, `system.activities.${activity.data._id}`, activity.data);

    return activity.data._id;

  }

}
