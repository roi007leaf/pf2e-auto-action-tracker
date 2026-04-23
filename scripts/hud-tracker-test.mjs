import assert from "node:assert/strict";

class FakeElement {
    constructor({ id = "", dataset = {}, selectors = {} } = {}) {
        this.id = id;
        this.dataset = { ...dataset };
        this._selectors = selectors;
    }

    querySelector(selector) {
        return this._selectors[selector] ?? null;
    }
}

const hudAltTarget = new FakeElement();
const hudVisibleTarget = new FakeElement();
const hudRow = new FakeElement({
    dataset: { combatantId: "c1" },
    selectors: {
        ".controls.alt": hudAltTarget,
        ".controls": hudVisibleTarget,
    },
});
const hudRoot = new FakeElement({
    id: "pf2e-hud-tracker",
    selectors: {
        '[data-combatant-id="c1"]': hudRow,
    },
});

const coreTarget = new FakeElement();
const coreRow = new FakeElement({
    dataset: { combatantId: "c2" },
    selectors: {
        ".token-name, .name-controls": coreTarget,
    },
});
const coreRoot = new FakeElement({
    selectors: {
        '[data-combatant-id="c2"]': coreRow,
    },
});

const {
    canShowManualActionButton,
    hasCompactOverspendTint,
    resolveMapMountTarget,
    resolveTrackerMount,
    shouldShowTrackerForMount,
} = await import("../src/trackerAdapters.ts");
const {
    hasEconomyRelevantActorUpdate,
    isEconomyConditionSlug,
    shouldRefreshEconomyImmediatelyForActor,
    shouldRefreshEconomyImmediatelyForCondition,
} = await import("../src/economySync.ts");
const { getSkillActionMapMetadata } = await import("../src/chatTypeDetectors/skillMapMetadata.ts");
const {
    getMapProfile,
    getCurrentMapState,
    formatMapLabel,
    getMapDisplayState,
    isMapRelevantAction,
} = await import("../src/mapTracker.ts");

const hudPlayerMount = resolveTrackerMount(hudRoot, "c1", false);
assert.equal(hudPlayerMount?.mode, "pf2e-hud");
assert.equal(hudPlayerMount?.target, hudVisibleTarget);

const hudGmMount = resolveTrackerMount(hudRoot, "c1", true);
assert.equal(hudGmMount?.mode, "pf2e-hud");
assert.equal(hudGmMount?.target, hudVisibleTarget);
assert.equal(resolveMapMountTarget(hudRoot, "c1"), hudAltTarget);

const coreMount = resolveTrackerMount(coreRoot, "c2");
assert.equal(coreMount?.mode, "core");
assert.equal(coreMount?.target, coreTarget);
assert.equal(resolveMapMountTarget(coreRoot, "c2"), null);

assert.equal(shouldShowTrackerForMount("pf2e-hud", true, false, true), true);
assert.equal(shouldShowTrackerForMount("pf2e-hud", false, true, true), true);
assert.equal(shouldShowTrackerForMount("pf2e-hud", false, false, true), false);
assert.equal(shouldShowTrackerForMount("core", false, false, true), true);

assert.equal(canShowManualActionButton(true), true);
assert.equal(canShowManualActionButton(false), false);

assert.equal(hasCompactOverspendTint(0), false);
assert.equal(hasCompactOverspendTint(2), true);

assert.equal(isEconomyConditionSlug("quickened"), true);
assert.equal(isEconomyConditionSlug("stunned"), true);
assert.equal(isEconomyConditionSlug("frightened"), false);
assert.equal(shouldRefreshEconomyImmediatelyForCondition("quickened"), true);
assert.equal(shouldRefreshEconomyImmediatelyForCondition("slowed"), true);
assert.equal(shouldRefreshEconomyImmediatelyForCondition("paralyzed"), true);
assert.equal(shouldRefreshEconomyImmediatelyForCondition("stunned"), false);

assert.equal(hasEconomyRelevantActorUpdate({ system: { resources: { reactions: { max: 2 } } } }), true);
assert.equal(hasEconomyRelevantActorUpdate({ system: { resources: { reactions: { value: 0 } } } }), false);
assert.equal(shouldRefreshEconomyImmediatelyForActor({ hasCondition: (slug) => slug === "stunned" }, { system: { resources: { reactions: { max: 0 } } } }), false);
assert.equal(shouldRefreshEconomyImmediatelyForActor({ hasCondition: () => false }, { system: { resources: { reactions: { max: 0 } } } }), true);

assert.equal(isMapRelevantAction({ isMapRelevant: true }), true);
assert.equal(isMapRelevantAction({ isMapRelevant: false }), false);
assert.equal(isMapRelevantAction({}), false);
assert.equal(getMapProfile({ mapProfile: "agile" }), "agile");
assert.equal(getMapProfile({}), "standard");

assert.deepEqual(getCurrentMapState([]), { penalty: 0, profile: "standard" });
assert.deepEqual(
    getCurrentMapState([{ isMapRelevant: true, mapProfile: "standard" }]),
    { penalty: 5, profile: "standard" }
);
assert.deepEqual(
    getCurrentMapState([{ isMapRelevant: true, mapProfile: "agile" }]),
    { penalty: 4, profile: "agile" }
);
assert.deepEqual(
    getCurrentMapState([
        { isMapRelevant: true, mapProfile: "agile" },
        { isMapRelevant: true, mapProfile: "agile" }
    ]),
    { penalty: 8, profile: "agile" }
);
assert.deepEqual(
    getCurrentMapState([
        { isMapRelevant: false },
        { isMapRelevant: true, mapProfile: "standard" },
        { isMapRelevant: true, mapProfile: "standard" }
    ]),
    { penalty: 10, profile: "standard" }
);

assert.equal(formatMapLabel({ penalty: 0, profile: "standard" }, false), "");
assert.equal(formatMapLabel({ penalty: 5, profile: "standard" }, false), "MAP 1: -4/-5");
assert.equal(formatMapLabel({ penalty: 4, profile: "agile" }, false), "MAP 1: -4/-5");
assert.equal(formatMapLabel({ penalty: 8, profile: "agile" }, false), "MAP 2: -8/-10");
assert.equal(formatMapLabel({ penalty: 0, profile: "standard" }, true), "");
assert.equal(formatMapLabel({ penalty: 4, profile: "agile" }, true), "M1");
assert.equal(formatMapLabel({ penalty: 8, profile: "agile" }, true), "M2");
assert.deepEqual(getMapDisplayState({ penalty: 0, profile: "standard" }), {
    visible: false,
    core: { text: "", inline: false, tooltip: "" },
    compact: { text: "", inline: true, tooltip: "" },
});
assert.deepEqual(getMapDisplayState({ penalty: 4, profile: "agile" }), {
    visible: true,
    core: { text: "MAP 1: -4/-5", inline: false, tooltip: "MAP 1: -4/-5" },
    compact: { text: "M1", inline: true, tooltip: "MAP 1: -4/-5" },
});
assert.deepEqual(getMapDisplayState({ penalty: 8, profile: "standard" }), {
    visible: true,
    core: { text: "MAP 2: -8/-10", inline: false, tooltip: "MAP 2: -8/-10" },
    compact: { text: "M2", inline: true, tooltip: "MAP 2: -8/-10" },
});

const grappleMessage = {
    flavor: '<span class="action-glyph">1</span>',
    content: "",
    item: {
        system: { time: { value: "1" } },
        traits: new Set(["attack"]),
    },
    flags: {
        pf2e: {
            context: {
                type: "skill-check",
                title: "<strong>Grapple</strong> (Athletics Check)",
                options: [
                    "check:statistic:athletics",
                    "action:grapple",
                    "trait:attack",
                ],
            },
        },
    },
};

assert.deepEqual(getSkillActionMapMetadata(grappleMessage), {
    isMapRelevant: true,
    mapProfile: "standard",
});

const tripMessageWithSystemTraits = {
    flavor: '<span class="action-glyph">1</span>',
    content: "",
    item: {
        system: {
            time: { value: "1" },
            traits: { value: ["attack"] },
        },
    },
    flags: {
        pf2e: {
            context: {
                type: "skill-check",
                title: "<strong>Trip</strong> (Athletics Check)",
                options: [
                    "check:statistic:athletics",
                    "action:trip",
                ],
            },
        },
    },
};

assert.deepEqual(getSkillActionMapMetadata(tripMessageWithSystemTraits), {
    isMapRelevant: true,
    mapProfile: "standard",
});

const grappleChatPayload = {
    flags: {
        pf2e: {
            context: {
                type: "skill-check",
                options: [
                    "action:grapple",
                    "attack",
                    "item:trait:attack",
                    "check:statistic:athletics",
                ],
                traits: ["attack"],
            },
            modifiers: [
                {
                    slug: "multiple-attack-penalty",
                    modifier: -4,
                },
            ],
        },
    },
};

assert.deepEqual(getSkillActionMapMetadata(grappleChatPayload), {
    isMapRelevant: true,
    mapProfile: "standard",
});

const systemDrainTooltip = "Used: Slowed 1";
assert.equal(systemDrainTooltip, "Used: Slowed 1");
