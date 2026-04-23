import assert from "node:assert/strict";

class FakeElement {
    constructor({ id = "", dataset = {}, classes = [], selectors = {} } = {}) {
        this.id = id;
        this.dataset = dataset;
        this._selectors = selectors;
        this.classList = {
            contains: (name) => classes.includes(name),
        };
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
    resolveTrackerMount,
    shouldShowTrackerForMount,
} = await import("../src/trackerAdapters.ts");
const {
    hasEconomyRelevantActorUpdate,
    isEconomyConditionSlug,
} = await import("../src/economySync.ts");

const hudPlayerMount = resolveTrackerMount(hudRoot, "c1", false);
assert.equal(hudPlayerMount?.mode, "pf2e-hud");
assert.equal(hudPlayerMount?.target, hudVisibleTarget);

const hudGmMount = resolveTrackerMount(hudRoot, "c1", true);
assert.equal(hudGmMount?.mode, "pf2e-hud");
assert.equal(hudGmMount?.target, hudVisibleTarget);

const coreMount = resolveTrackerMount(coreRoot, "c2");
assert.equal(coreMount?.mode, "core");
assert.equal(coreMount?.target, coreTarget);

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

assert.equal(hasEconomyRelevantActorUpdate({ system: { resources: { reactions: { max: 2 } } } }), true);
assert.equal(hasEconomyRelevantActorUpdate({ system: { resources: { reactions: { value: 0 } } } }), false);
