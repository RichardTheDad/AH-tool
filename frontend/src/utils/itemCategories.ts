export interface ItemCategoryOption {
  value: string;
  label: string;
}

export interface ItemCategoryGroup extends ItemCategoryOption {
  subcategories: ItemCategoryOption[];
}

const NON_COMMODITY_CATEGORY_GROUPS: ItemCategoryGroup[] = [
  {
    value: "Weapon",
    label: "Weapons",
    subcategories: [
      "One-Handed Axes",
      "One-Handed Maces",
      "One-Handed Swords",
      "Warglaives",
      "Daggers",
      "Fist Weapons",
      "Wands",
      "Two-Handed Axes",
      "Two-Handed Maces",
      "Two-Handed Swords",
      "Polearms",
      "Staves",
      "Bows",
      "Crossbows",
      "Guns",
      "Thrown",
      "Fishing Poles",
      "Miscellaneous",
    ].map(toOption),
  },
  {
    value: "Armor",
    label: "Armor",
    subcategories: ["Plate", "Mail", "Leather", "Cloth", "Miscellaneous", "Cosmetic"].map(toOption),
  },
  {
    value: "Container",
    label: "Containers",
    subcategories: [
      "Bag",
      "Herb Bag",
      "Enchanting Bag",
      "Engineering Bag",
      "Gem Bag",
      "Mining Bag",
      "Leatherworking Bag",
      "Inscription Bag",
      "Tackle Box",
      "Cooking Bag",
      "Reagent Bag",
    ].map(toOption),
  },
  {
    value: "Item Enhancement",
    label: "Item Enhancements",
    subcategories: [
      "Head",
      "Neck",
      "Shoulder",
      "Cloak",
      "Chest",
      "Wrist",
      "Hands",
      "Waist",
      "Legs",
      "Feet",
      "Finger",
      "Weapon",
      "Two-Handed Weapon",
      "Shield/Off-hand",
      "Misc",
    ].map(toOption),
  },
  {
    value: "Glyph",
    label: "Glyphs",
    subcategories: [
      "Warrior",
      "Paladin",
      "Hunter",
      "Rogue",
      "Priest",
      "Shaman",
      "Mage",
      "Warlock",
      "Druid",
      "Death Knight",
      "Monk",
      "Demon Hunter",
    ].map(toOption),
  },
  {
    value: "Recipe",
    label: "Recipes",
    subcategories: [
      "Leatherworking",
      "Tailoring",
      "Engineering",
      "Blacksmithing",
      "Alchemy",
      "Enchanting",
      "Jewelcrafting",
      "Inscription",
      "Cooking",
      "First Aid",
      "Fishing",
      "Book",
    ].map(toOption),
  },
  {
    value: "Profession Equipment",
    label: "Profession Equipment",
    subcategories: [
      "Inscription",
      "Tailoring",
      "Leatherworking",
      "Jewelcrafting",
      "Alchemy",
      "Blacksmithing",
      "Engineering",
      "Enchanting",
      "Mining",
      "Herbalism",
      "Skinning",
      "Cooking",
      "Fishing",
    ].map(toOption),
  },
  {
    value: "Battle Pets",
    label: "Battle Pets",
    subcategories: [
      "Humanoid",
      "Dragonkin",
      "Flying",
      "Undead",
      "Critter",
      "Magic",
      "Elemental",
      "Beast",
      "Aquatic",
      "Mechanical",
      "Companion Pets",
    ].map(toOption),
  },
  {
    value: "Miscellaneous",
    label: "Miscellaneous",
    subcategories: ["Junk", "Holiday", "Other", "Mount", "Mount Equipment"].map(toOption),
  },
];

const CATEGORY_LABELS = new Map(NON_COMMODITY_CATEGORY_GROUPS.map((group) => [group.value.toLowerCase(), group.label]));

function toOption(value: string): ItemCategoryOption {
  return { value, label: value };
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function sortByCatalogOrder<T extends ItemCategoryOption>(options: T[], catalogOrder: string[]): T[] {
  const order = new Map(catalogOrder.map((value, index) => [normalizeKey(value), index]));
  return [...options].sort((left, right) => {
    const leftOrder = order.get(normalizeKey(left.value));
    const rightOrder = order.get(normalizeKey(right.value));
    if (leftOrder !== undefined || rightOrder !== undefined) {
      return (leftOrder ?? Number.MAX_SAFE_INTEGER) - (rightOrder ?? Number.MAX_SAFE_INTEGER);
    }
    return left.label.localeCompare(right.label);
  });
}

export function getCategoryLabel(value: string) {
  return CATEGORY_LABELS.get(normalizeKey(value)) ?? value;
}

export function buildCategoryGroupsFromResults(
  rows: Array<{ item_class_name?: string | null; item_subclass_name?: string | null }>,
): ItemCategoryGroup[] {
  const groupsByKey = new Map<string, ItemCategoryGroup>();

  for (const group of NON_COMMODITY_CATEGORY_GROUPS) {
    groupsByKey.set(normalizeKey(group.value), {
      ...group,
      subcategories: [...group.subcategories],
    });
  }

  for (const row of rows) {
    const className = row.item_class_name?.trim();
    if (!className) {
      continue;
    }

    const classKey = normalizeKey(className);
    const group = groupsByKey.get(classKey) ?? {
      value: className,
      label: getCategoryLabel(className),
      subcategories: [],
    };

    const subclassName = row.item_subclass_name?.trim();
    if (subclassName && !group.subcategories.some((option) => normalizeKey(option.value) === normalizeKey(subclassName))) {
      group.subcategories.push(toOption(subclassName));
    }

    groupsByKey.set(classKey, group);
  }

  const categoryOrder = NON_COMMODITY_CATEGORY_GROUPS.map((group) => group.value);
  return sortByCatalogOrder(Array.from(groupsByKey.values()), categoryOrder).map((group) => ({
    ...group,
    subcategories: sortByCatalogOrder(group.subcategories, group.subcategories.map((option) => option.value)),
  }));
}
