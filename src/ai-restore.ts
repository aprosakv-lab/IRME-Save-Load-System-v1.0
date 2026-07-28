import type { AgentState } from './types';

type SerializeFn = (agentInstance: any) => Promise<AgentState> | AgentState;
type RestoreFn = (state: AgentState) => Promise<any> | any;

export class AgentRegistry {
  private static _instance: AgentRegistry | undefined;
  private types: Map<string, { restore: RestoreFn; serialize?: SerializeFn }> = new Map();

  static instance() {
    if (!this._instance) this._instance = new AgentRegistry();
    return this._instance;
  }

  registerAgentType(type: string, restore: RestoreFn, serialize?: SerializeFn) {
    this.types.set(type, { restore, serialize });
  }

  async restoreAgentFromState(state: AgentState) {
    const entry = this.types.get(state.type);
    if (!entry) {
      console.warn(`No agent type registered for ${state.type}, skipping restore.`);
      return null;
    }
    try {
      return await entry.restore(state);
    } catch (err) {
      console.error('Error restoring agent', state.agentId, err);
      return null;
    }
  }

  async serializeAgentInstance(type: string, instance: any): Promise<AgentState | null> {
    const entry = this.types.get(type);
    if (!entry || !entry.serialize) return null;
    return await entry.serialize(instance);
  }
}
