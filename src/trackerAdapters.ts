export type TrackerMountMode = "core" | "pf2e-hud";

type QueryableNode = {
    id?: string;
    querySelector(selector: string): any;
};

type TrackerMount = {
    mode: TrackerMountMode;
    row: any;
    target: any;
};

export function resolveTrackerMount(root: QueryableNode, combatantId: string, hudAlternateControls = true): TrackerMount | null {
    const row = root.querySelector(`[data-combatant-id="${combatantId}"]`);
    if (!row) return null;

    const mode: TrackerMountMode = root.id === "pf2e-hud-tracker" ? "pf2e-hud" : "core";
    const targetSelector = mode === "pf2e-hud"
        ? ".controls"
        : ".token-name, .name-controls";
    const target = row.querySelector(targetSelector);

    if (!target) return null;

    return { mode, row, target };
}

export function resolveMapMountTarget(root: QueryableNode, combatantId: string): any | null {
    if (root.id !== "pf2e-hud-tracker") return null;

    const row = root.querySelector(`[data-combatant-id="${combatantId}"]`);
    if (!row) return null;

    return row.querySelector(".controls.alt");
}

export function shouldShowTrackerForMount(
    mode: TrackerMountMode,
    isGM: boolean,
    isOwner: boolean,
    isPC: boolean,
): boolean {
    if (isGM) return true;
    if (mode === "pf2e-hud") return isOwner;
    return isOwner || isPC;
}

export function canShowManualActionButton(isGM: boolean): boolean {
    return isGM;
}

export function hasCompactOverspendTint(overflowCount: number): boolean {
    return overflowCount > 0;
}
