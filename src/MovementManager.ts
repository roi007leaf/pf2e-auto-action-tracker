import { SCOPE } from "./globals.ts";
import { ActorPF2e, CombatantPF2e } from "module-helpers";
import { ActionManager } from "./ActionManager.ts";
import { ActorHandler } from "./ActorHandler.ts";
import { ChatManager } from "./ChatManager.ts";
import { logError } from "./logger.ts"

const MOVEMENT_FLAG = "movementHistorySnapshot";

export class MovementManager {

    // Synchronous local storage for history length to prevent race conditions
    private static _historyLengths = new Map<string, number>();
    private static _lastTokenPositions = new Map<string, { x: number, y: number, elevation: number }>();
    private static _movementPaths = new Map<string, { x: number, y: number, elevation: number }[]>();
    /**
     * Checks if a specific msgId belongs to a movement action
     */
    static isMoveAction(msgId: string | undefined): boolean {
        return !!msgId?.startsWith('move-');
    }

    static async handleTokenUpdate(tokenDoc: any, update: any) {
        const combatant = tokenDoc.combatant;
        if (!combatant) return;

        const coordList = MovementManager.getMovementCoordinates(tokenDoc, update);
        try {
            await MovementManager._processMovement(combatant, tokenDoc, coordList, false);
        } catch (err) {
            logError("Movement Processing Error:", err);
        }
    }

    static captureTokenPosition(tokenDoc: any, update: any) {
        if (!tokenDoc?.id || !("x" in update || "y" in update || "elevation" in update)) return;

        MovementManager._lastTokenPositions.set(tokenDoc.id, {
            x: tokenDoc.x,
            y: tokenDoc.y,
            elevation: tokenDoc.elevation ?? 0
        });
    }

    /**
     * Logic for movement cost calculation across regions (difficult terrain)
     */
    static calculateMovementCost(token: any, distance: number, toPoint: { x: number, y: number }): number {
        const regions = (canvas.regions as any).placeables.filter((r: any) =>
            r.document.behaviors.some((b: any) => !b.disabled && b.type === "environmentFeature") &&
            token.testInsideRegion(r, toPoint)
        );

        if (regions.length > 0) {
            const behaviors = regions.flatMap((r: any) =>
                r.document.behaviors.filter((b: any) => b.type === "environmentFeature")
            );
            const hasGreatDifficult = behaviors.some((b: any) => b.system?.terrain?.difficult === 2);
            return hasGreatDifficult ? distance + 10 : distance + 5;
        }
        return distance;
    }

    static measurePath(actor: any, token: any, path: any[], movementMode: string) {
        const { distance } = (canvas.grid as any).measurePath(path);
        const mode = movementMode || "stride";
        const activeSpeed = ActorHandler.getActiveSpeed(actor, mode) || 30;
        const cost = Math.ceil(distance / activeSpeed);
        const isDifficult = this.checkDifficultTerrain(token, path);
        const label = this.getMovementLabel(distance, cost, mode, isDifficult);

        return { distance, cost, isDifficult, label };
    }

    static getPathData(actor: ActorPF2e, tokenDoc: any, coordList: any[], mode: string) {
        const path = coordList.map(p => ({ x: p.x, y: p.y }));
        const { distance } = (canvas.grid as any).measurePath(path);
        const activeSpeed = ActorHandler.getActiveSpeed(actor, mode) || 30;
        const cost = Math.ceil(distance / activeSpeed);
        const isDifficult = this.checkDifficultTerrain(tokenDoc.object, coordList);
        const label = this.getMovementLabel(distance, cost, mode, isDifficult);

        return { distance, cost, label };
    }

    /**
      * Handles movements for a token.  Will use the PF2E rules class to properly measure the distance based on the coordinates
      * provided by Foundry, and find the appropriate number of actions needed to move that distance
      * Note: Also handles Ctrl + Z "undo", removing actions to get to the move action if needed -> This is in case
      *       a move -> strike -> move occurs, and the first move is needed to hit the strike.  Will undo the strike and send a whisper
      *       to the actor and GM so they can do what is needed to finish undoing the strike as that is not automated (yet?)
      * @param recursiveCall - If set to false, will store the movement coordinates list on the combatant.
      * @returns 
      */
    private static async _processMovement(combatant: CombatantPF2e, tokenDoc: any, coordList: any[], recursiveCall: boolean): Promise<void> {
        const c = combatant as any;
        if (!(game as any).combat?.active) return;
        // 80/20 rule - 80% of actions not on a turn are either forced or free actions from trigger.  If there is movement by the
        // combatant during someone else's turn, just ignore it... and let a manual addition handle if desired
        if ((game as any).combat.combatant?.id !== c.id) return;

        const actor: ActorPF2e = c.actor;
        if (!actor) return;

        // --- 1. HANDLE COMPLETE CLEAR (Undo to zero) ---
        if (coordList.length === 0) {
            await this._performUndo(combatant, actor, tokenDoc);
            return;
        }

        const path = coordList.map(p => ({ x: p.x, y: p.y }));
        // This takes into account rough terrain and adds appropriate distance as needed
        const { distance } = (canvas.grid as any).measurePath(path);

        // Jitter/GM Drag Checks
        if (distance === 0 || distance > 200) return;

        const movementMode = tokenDoc.movementAction === "walk" ? "stride" : (tokenDoc.movementAction || "stride");
        const activeSpeed = ActorHandler.getActiveSpeed(actor, movementMode);
        const isDifficult = MovementManager.checkDifficultTerrain(tokenDoc.object, coordList);

        const allActions = ActionManager.getFlattenedActions(combatant);
        const moveActions = allActions.filter(a => MovementManager.isMoveAction(a.msgId));

        const getDist = (act: any) => {
            if (act.label === 'Step') return 5;
            const match = act.label.match(/\d+/);
            return match ? parseInt(match[0]) : 0;
        };
        const totalRecorded = moveActions.reduce((acc, a) => acc + getDist(a), 0);

        // --- 2. EVALUATE CHANGES ---
        if (distance === totalRecorded) return;

        const lastResult = ActionManager.getLastAction(combatant);
        const activeMsgId = lastResult?.isSubAction ? lastResult.subAction?.msgId : lastResult?.entry.msgId;

        // B. ACTUAL UNDO (Ctrl+Z detected)
        if (MovementManager.isUndoMovement(tokenDoc, coordList)) {
            if (lastResult && activeMsgId) {
                await ActionManager.removeAction(combatant, activeMsgId);
                if (!MovementManager.isMoveAction(activeMsgId)) {
                    ChatManager.triggerAlert(actor, 'Undo Correction', `Movement undo detected. Reverted: ${lastResult.actionLabel ?? lastResult.entry.label}`, 'undoAlert');
                }
                MovementManager.storeMovement(tokenDoc, coordList);
                await MovementManager._processMovement(combatant, tokenDoc, coordList, true);
            }
            return;
        }

        // C. TOKEN MOVEMENT (Adjusting current ruler or adding new segment)
        if (distance !== totalRecorded) {
            if (lastResult && activeMsgId && MovementManager.isMoveAction(activeMsgId)) {
                const newCost = Math.ceil(distance / activeSpeed);
                const label = MovementManager.getMovementLabel(distance, newCost, movementMode, isDifficult);
                await ActionManager.editAction(combatant, activeMsgId, { label, cost: newCost, slug: movementMode });
            } else {
                const newDistance = distance - totalRecorded;
                if (newDistance > 0) {
                    const moveMsgId = `move-${tokenDoc.id}-${Date.now()}`;
                    const cost = Math.ceil(newDistance / activeSpeed);
                    const label = MovementManager.getMovementLabel(newDistance, cost, movementMode, isDifficult);

                    await ActionManager.addAction(combatant, {
                        cost,
                        msgId: moveMsgId,
                        label,
                        type: 'action',
                        category: "move",
                        slug: movementMode,
                        linkedMessages: [],
                        isQuickenedEligible: true
                    });
                }
            }
        }
        if (!recursiveCall) MovementManager.storeMovement(tokenDoc, coordList);
    }

    /**
     * Dedicated Undo Handler for readability.
     * Pops actions until a movement action is found and removed.
     */
    private static async _performUndo(combatant: any, actor: any, tokenDoc: any) {
        let safety = 0;
        while (safety < 50) {
            const lastResult = ActionManager.getLastAction(combatant);
            if (!lastResult) break;

            const targetId = lastResult.isSubAction ? lastResult.subAction?.msgId : lastResult.entry.msgId;
            const label = lastResult.isSubAction ? lastResult.actionLabel : lastResult.entry.label;

            if (targetId) {
                const wasMove = MovementManager.isMoveAction(targetId);
                await ActionManager.removeAction(combatant, targetId);

                if (!wasMove) {
                    ChatManager.triggerAlert(actor, 'Undo Correction', `Movement undo detected. Reverted: ${label}`, 'undoAlert');
                } else {
                    break; // Successfully removed the movement segment
                }
            }
            safety++;
        }
        MovementManager._historyLengths.delete(tokenDoc.id);
        MovementManager._movementPaths.delete(tokenDoc.id);
    }

    static getMovementLabel(distance: number, cost: number, mode: string, isDifficult: boolean) {
        if (distance === 5 && cost === 1 && !isDifficult && mode === "stride") {
            return 'Step';
        }
        const capitalized = mode.charAt(0).toUpperCase() + mode.slice(1);
        return `${capitalized}: ${distance}ft`;
    }

    private static checkDifficultTerrain(token: any, coordList: any[]): boolean {
        if (!canvas.regions) return false;
        const lastPoint = coordList[coordList.length - 1];
        if (!lastPoint) return false;

        return (canvas.regions as any).placeables.some((r: any) =>
            r.document.behaviors.some((b: any) => !b.disabled && b.type === "environmentFeature") &&
            token.testInsideRegion(r, lastPoint)
        );
    }

    private static storeMovement(tokenDoc: any, coordList: any[]) {
        MovementManager._historyLengths.set(tokenDoc.id, coordList.length);
        MovementManager._movementPaths.set(tokenDoc.id, coordList);
    }

    private static isUndoMovement(tokenDoc: any, coordList: any[]): boolean {
        const lastLength = MovementManager._historyLengths.get(tokenDoc.id) || 0;
        return coordList.length < lastLength;
    }

    private static getMovementCoordinates(tokenDoc: any, update: any): { x: number, y: number, elevation: number }[] {
        const history = tokenDoc._movementHistory || [];
        if (history.length > 0) {
            return history.map((p: any) => ({ x: p.x, y: p.y, elevation: p.elevation ?? 0 }));
        }

        const previous = MovementManager._lastTokenPositions.get(tokenDoc.id);
        if (!previous || !("x" in update || "y" in update || "elevation" in update)) return [];

        const current = {
            x: update.x ?? tokenDoc.x,
            y: update.y ?? tokenDoc.y,
            elevation: update.elevation ?? tokenDoc.elevation ?? 0
        };

        if (previous.x === current.x && previous.y === current.y && previous.elevation === current.elevation) return [];

        const existingPath = MovementManager._movementPaths.get(tokenDoc.id) ?? [previous];
        const lastPoint = existingPath[existingPath.length - 1];
        if (lastPoint && lastPoint.x === current.x && lastPoint.y === current.y && lastPoint.elevation === current.elevation) {
            return existingPath;
        }

        return [...existingPath, current];
    }

}
