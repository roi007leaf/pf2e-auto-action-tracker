import assert from "node:assert/strict";

class FakeElement {
    constructor({ id = "", classNames = [], dataset = {}, selectors = {} } = {}) {
        this.id = id;
        this.classList = { contains: className => classNames.includes(className) };
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
const hudRootWithAlternateControls = new FakeElement({
    id: "pf2e-hud-tracker",
    classNames: ["alternate-controls"],
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
    findPf2eHudTracker,
    getTrackerRenderKey,
    hasCompactOverspendTint,
    isPf2eHudTracker,
    PF2E_HUD_TRACKER_ID,
    resolveMapMountTarget,
    resolveTrackerMount,
    shouldShowTrackerForMount,
} = await import("../src/trackerAdapters.ts");
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
assert.equal(PF2E_HUD_TRACKER_ID, "pf2e-hud-tracker");
assert.equal(isPf2eHudTracker(hudRoot), true);
assert.equal(isPf2eHudTracker(coreRoot), false);
assert.equal(findPf2eHudTracker({ getElementById: id => id === PF2E_HUD_TRACKER_ID ? hudRoot : null }), hudRoot);

const hudGmMount = resolveTrackerMount(hudRoot, "c1", true);
assert.equal(hudGmMount?.mode, "pf2e-hud");
assert.equal(hudGmMount?.target, hudVisibleTarget);
assert.equal(resolveMapMountTarget(hudRoot, "c1"), null);
assert.equal(resolveMapMountTarget(hudRootWithAlternateControls, "c1"), hudAltTarget);

const coreMount = resolveTrackerMount(coreRoot, "c2");
assert.equal(coreMount?.mode, "core");
assert.equal(coreMount?.target, coreTarget);
assert.equal(resolveMapMountTarget(coreRoot, "c2"), null);

assert.equal(shouldShowTrackerForMount("pf2e-hud", true, false, true), true);
assert.equal(shouldShowTrackerForMount("pf2e-hud", false, true, true), true);
assert.equal(shouldShowTrackerForMount("pf2e-hud", false, false, true), false);
assert.equal(shouldShowTrackerForMount("core", false, false, true), true);

assert.equal(canShowManualActionButton(true, false), true);
assert.equal(canShowManualActionButton(false, true), true);
assert.equal(canShowManualActionButton(false, false), false);

const renderKeyLog = [
    { msgId: "a1", type: "action", cost: 1, label: "Strike", isQuickenedEligible: true, isMapRelevant: true },
    { msgId: "r1", type: "reaction", cost: 1, label: "Reactive Strike", isQuickenedEligible: false },
];
assert.equal(
    getTrackerRenderKey({
        mode: "pf2e-hud",
        combatantId: "c1",
        isGM: true,
        isOwner: false,
        isPC: true,
        isQuickened: false,
        mapAttackCount: 1,
        maxReactions: 1,
        log: renderKeyLog,
    }),
    'pf2e-hud|c1|gm:1|owner:0|pc:1|quick:0|map:1|reactions:1|a1:action:1:Strike:1:1:::|r1:reaction:1:Reactive Strike:0:0:::'
);
assert.notEqual(
    getTrackerRenderKey({
        mode: "pf2e-hud",
        combatantId: "c1",
        isGM: true,
        isOwner: false,
        isPC: true,
        isQuickened: false,
        mapAttackCount: 2,
        maxReactions: 1,
        log: renderKeyLog,
    }),
    getTrackerRenderKey({
        mode: "pf2e-hud",
        combatantId: "c1",
        isGM: true,
        isOwner: false,
        isPC: true,
        isQuickened: false,
        mapAttackCount: 1,
        maxReactions: 1,
        log: renderKeyLog,
    })
);

assert.equal(hasCompactOverspendTint(0), false);
assert.equal(hasCompactOverspendTint(2), true);

assert.equal(isMapRelevantAction({ isMapRelevant: true }), true);
assert.equal(isMapRelevantAction({ isMapRelevant: false }), false);
assert.equal(isMapRelevantAction({ isMapRelevant: true, actionModifiers: ["deferMAP"] }), false);
assert.equal(isMapRelevantAction({}), false);
assert.equal(getMapProfile({ mapProfile: "agile" }), "agile");
assert.equal(getMapProfile({}), "standard");

assert.deepEqual(getCurrentMapState([]), { attackCount: 0, penalty: 0, profile: "standard" });
assert.deepEqual(
    getCurrentMapState([{ isMapRelevant: true, mapProfile: "standard" }]),
    { attackCount: 1, penalty: 5, profile: "standard" }
);
assert.deepEqual(
    getCurrentMapState([{ isMapRelevant: true, mapProfile: "agile" }]),
    { attackCount: 1, penalty: 4, profile: "agile" }
);
assert.deepEqual(
    getCurrentMapState([{ isMapRelevant: true, actionModifiers: ["deferMAP"] }]),
    { attackCount: 0, penalty: 0, profile: "standard" }
);
assert.deepEqual(
    getCurrentMapState([
        { isMapRelevant: true, mapProfile: "agile" },
        { isMapRelevant: true, mapProfile: "agile" }
    ]),
    { attackCount: 2, penalty: 8, profile: "agile" }
);
assert.deepEqual(
    getCurrentMapState([
        { isMapRelevant: false },
        { isMapRelevant: true, mapProfile: "standard" },
        { isMapRelevant: true, mapProfile: "standard" }
    ]),
    { attackCount: 2, penalty: 10, profile: "standard" }
);

assert.equal(formatMapLabel({ attackCount: 0, penalty: 0 }, false), "");
assert.equal(formatMapLabel({ attackCount: 1, penalty: 5 }, false), "MAP: -5");
assert.equal(formatMapLabel({ attackCount: 1, penalty: 4 }, false), "MAP: -4");
assert.equal(formatMapLabel({ attackCount: 2, penalty: 8 }, false), "MAP: -8");
assert.equal(formatMapLabel({ attackCount: 0, penalty: 0 }, true), "");
assert.equal(formatMapLabel({ attackCount: 1, penalty: 4 }, true), "-4");
assert.equal(formatMapLabel({ attackCount: 2, penalty: 8 }, true), "-8");
assert.deepEqual(getMapDisplayState({ attackCount: 0, penalty: 0 }), {
    visible: false,
    core: { text: "", inline: false, tooltip: "" },
    compact: { text: "", inline: true, tooltip: "" },
});
assert.deepEqual(getMapDisplayState({ attackCount: 1, penalty: 4 }), {
    visible: true,
    core: { text: "MAP: -4", inline: false, tooltip: "MAP 1: -4" },
    compact: { text: "-4", inline: true, tooltip: "MAP 1: -4" },
});
assert.deepEqual(getMapDisplayState({ attackCount: 2, penalty: 10 }), {
    visible: true,
    core: { text: "MAP: -10", inline: false, tooltip: "MAP 2: -10" },
    compact: { text: "-10", inline: true, tooltip: "MAP 2: -10" },
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
