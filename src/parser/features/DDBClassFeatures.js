import logger from "../../logger.js";
import DDBChoiceFeature from "./DDBChoiceFeature.js";
import DDBFeature from "./DDBFeature.js";
import DDBFeatures from "./DDBFeatures.js";
import DDBFeatureEnricher from "../enrichers/DDBFeatureEnricher.js";


export default class DDBClassFeatures {

  constructor({ ddbData, rawCharacter = null } = {}) {
    this.ddbData = ddbData;
    this.rawCharacter = rawCharacter;
    this.data = [];

    this.featureList = {
      class: [],
      subClass: [],
    };
    this.data = [];
    this._processed = [];

    this.excludedFeatures = this.ddbData.character.optionalClassFeatures
      .filter((f) => f.affectedClassFeatureId)
      .map((f) => f.affectedClassFeatureId);
    this.enricher = new DDBFeatureEnricher();
  }

  async _getFeatures(featureDefinition, type, source, filterByLevel = true, flags = {}) {
    const feature = new DDBFeature({
      ddbData: this.ddbData,
      ddbDefinition: featureDefinition,
      rawCharacter: this.rawCharacter,
      type,
      source,
      extraFlags: flags,
      enricher: this.enricher,
    });
    feature.build();
    const allowedByLevel = !filterByLevel || (filterByLevel && feature.hasRequiredLevel);

    logger.debug(`DDBClassFeatures._getFeatures: ${feature.ddbDefinition.name}`, {
      featureDefinition,
      feature,
      this: this,
    });

    if (!allowedByLevel) return [];
    const choiceFeatures = feature.isChoiceFeature
      ? await DDBChoiceFeature.buildChoiceFeatures(feature)
      : [];
    return [feature.data].concat(choiceFeatures);
  }


  async _generateClassFeatures(klass) {

    const className = klass.definition.name;
    const classFeatureIds = klass.definition.classFeatures.map((f) => f.id);

    const classFeatures = klass.classFeatures.filter(
      (feat) =>
        classFeatureIds.includes(feat.definition.id)
        && DDBFeatures.includedFeatureNameCheck(feat.definition.name)
        && feat.definition.requiredLevel <= klass.level,
    );

    const classFeatureList = (await Promise.all(classFeatures
      .filter((feat) => !this.excludedFeatures.includes(feat.definition.id))
      .map(async (feat) => {
        let items = await this._getFeatures(feat, "class", className, {
          "ddbimporter": {
            class: klass.definition.name,
            classId: klass.definition.id,
          },
          "flags.obsidian.source.text": className,
        });
        this.featureList.class.push(...foundry.utils.duplicate(items));
        return items;
        // return items.map((item) => {
        //   item.flags.ddbimporter.dndbeyond.class = className;
        //   foundry.utils.setProperty(item.flags, "ddbimporter.class", klass.definition.name);
        //   foundry.utils.setProperty(item.flags, "ddbimporter.classId", klass.definition.id);
        //   item.flags.obsidian.source.text = className;
        //   // add feature to all features list
        //   this.featureList.class.push(foundry.utils.duplicate(item));
        //   return item;
        // });
      })))
      .flat()
      .sort((a, b) => {
        return a.flags.ddbimporter.dndbeyond.displayOrder - b.flags.ddbimporter.dndbeyond.displayOrder;
      });

    classFeatureList.forEach((item) => {
      // have we already processed an identical item?
      if (!DDBFeatures.isDuplicateFeature(this._processed, item)) {
        const existingFeature = DDBFeatures.getNameMatchedFeature(this.data, item);
        const duplicateFeature = DDBFeatures.isDuplicateFeature(this.data, item);
        if (existingFeature && !duplicateFeature) {
          const levelAdjustment = `<h3>${className}: Level ${item.flags.ddbimporter.dndbeyond.requiredLevel}</h3>${item.system.description.value}`;
          existingFeature.system.description.value += levelAdjustment;
          existingFeature.effects.push(...item.effects);
        } else if (!existingFeature) {
          this.data.push(item);
        }
      }
    });
    this._processed.push(...this.featureList.class, ...classFeatureList);
  }

  async _generateSubClassFeatures(klass) {
    const subClassFeatureIds = klass.classFeatures
      .filter((f) => f.definition.classId === klass.subclassDefinition.id)
      .map((f) => f.definition.id);

    const className = klass.definition.name;
    const subClassName = `${className} : ${klass.subclassDefinition.name}`;

    let subClassItems = [];

    const subClassFeatures = klass.classFeatures.filter(
      (feat) =>
        subClassFeatureIds.includes(feat.definition.id)
        && DDBFeatures.includedFeatureNameCheck(feat.definition.name)
        && feat.definition.requiredLevel <= klass.level
        && !this.excludedFeatures.includes(feat.definition.id),
    );

    const subClass = foundry.utils.getProperty(klass, "subclassDefinition");
    const subClassFeatureList = (await Promise.all(subClassFeatures
      .map(async (feat) => {
        let items = await this._getFeatures(feat, "class", subClassName, {
          "ddbimporter": {
            class: klass.definition.name,
            classId: klass.definition.id,
            subClass: subClass?.name,
            subClassId: subClass?.id,
          },
          "flags.obsidian.source.text": className,
        });
        this.featureList.subClass.push(...foundry.utils.duplicate(items));
        return items;
        // return items.map((item) => {
        //   item.flags.ddbimporter.dndbeyond.class = subClassName;
        //   item.flags.obsidian.source.text = className;
        //   foundry.utils.setProperty(item.flags, "ddbimporter.class", klass.definition.name);
        //   foundry.utils.setProperty(item.flags, "ddbimporter.classId", klass.definition.id);
        //   const subClass = foundry.utils.getProperty(klass, "subclassDefinition");
        //   foundry.utils.setProperty(item.flags, "ddbimporter.subClass", subClass?.name);
        //   foundry.utils.setProperty(item.flags, "ddbimporter.subClassId", subClass?.id);
        //   // add feature to all features list
        //   this.featureList.subClass.push(foundry.utils.duplicate(item));
        //   return item;
        // });
      })))
      .flat()
      .sort((a, b) => {
        return a.flags.ddbimporter.dndbeyond.displayOrder - b.flags.ddbimporter.dndbeyond.displayOrder;
      });

    // parse out duplicate features from class features
    subClassFeatureList.forEach((item) => {
      if (!DDBFeatures.isDuplicateFeature(this.featureList.class, item)) {
        const existingFeature = DDBFeatures.getNameMatchedFeature(subClassItems, item);
        const duplicateFeature = DDBFeatures.isDuplicateFeature(subClassItems, item);
        if (existingFeature && !duplicateFeature) {
          const levelAdjustment = `<h3>${subClassName}: At Level ${item.flags.ddbimporter.dndbeyond.requiredLevel}</h3>${item.system.description.value}`;
          existingFeature.system.description.value += levelAdjustment;
        } else if (!existingFeature) {
          subClassItems.push(item);
        }
      }
    });
    // add features to list to indicate processed
    this._processed.push(...this.featureList.subClass, ...subClassFeatureList);

    // now we take the unique subclass features and add to class
    subClassItems.forEach((item) => {
      const existingFeature = DDBFeatures.getNameMatchedFeature(this.data, item);
      const duplicateFeature = DDBFeatures.isDuplicateFeature(this.data, item);
      if (existingFeature && !duplicateFeature) {
        const levelAdjustment = `<h3>${subClassName}: At Level ${item.flags.ddbimporter.dndbeyond.requiredLevel}</h3>${item.system.description.value}`;
        existingFeature.system.description.value += levelAdjustment;
      } else if (!existingFeature) {
        this.data.push(item);
      }
    });

  }

  async build() {
    await this.enricher.init();
    // subclass features can often be duplicates of class features.
    for (const klass of this.ddbData.character.classes) {
      logger.debug(`Processing class features for ${klass.definition.name}`);
      await this._generateClassFeatures(klass);
      // subclasses
      if (klass.subclassDefinition && klass.subclassDefinition.classFeatures) {
        logger.debug(`Processing subclass features for ${klass.subclassDefinition.name}`);
        await this._generateSubClassFeatures(klass);
      }
      logger.debug(`ddbClassFeatures for ${klass.definition.name}`, { ddbClassFeatures: this });
    }
    // return this.data;
  }

}
