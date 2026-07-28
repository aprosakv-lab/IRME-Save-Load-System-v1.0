// Tipos fundamentais para o núcleo de persistência IRME
export type Tick = number;
export type ID = string;
export type ISOTime = string;

export interface WorldMeta {
  v: string; // versão do formato, ex: "3.0"
  tick: Tick; // tick atual
  createdAt: ISOTime;
  updatedAt: ISOTime;
  name?: string;
  energia?: number;
  complexidade?: number;
  consciencia?: number;
  info?: Record<string, any>;
}

export interface Vec3 { x: number; y: number; z: number; }

export interface WorldObject {
  id: ID;
  nome: string;
  tipo: string;
  propriedades: Record<string, any>;
  posicao?: Vec3;
  velocidade?: Vec3;
  estado?: string;
  versao?: number;
  evolucoes?: number;
  abexos?: ID[];
  tickCriacao?: Tick;
  timestamp?: ISOTime;
  // metadata para concorrência/sync
  updatedAt?: number; // epoch ms for LWW
  actor?: string; // who changed it last (optional)
}

export interface Abexo {
  id: ID;
  nome: string;
  descricao?: string;
  efeitos?: Record<string, any>;
  icone?: string;
  cor?: string;
  objetosVinculados?: ID[];
  tickCriacao?: Tick;
}

export type TimelineEventType = 'OBJETO_CRIADO' | 'VINCULO' | 'OBJETO_UPDATE' | 'SNAPSHOT' | string;

export interface TimelineEvent {
  id: ID;
  tipo: TimelineEventType;
  dados: Record<string, any>;
  tick: Tick;
  timestamp: ISOTime;
}

export interface Snapshot {
  id: ID;
  tick: Tick;
  timestamp: ISOTime;
  meta: Partial<WorldMeta>;
  // reference lists to object ids (to avoid duplicating large blobs in DB snapshots)
  objectIds: ID[];
  // optional small summary or diff
  summary?: string;
}

export interface GLBAsset {
  id: ID; // id used in objects to reference
  filename?: string;
  mime?: string; // "model/gltf-binary"
  size?: number;
  createdAt?: ISOTime;
}

export interface AgentState {
  agentId: ID;
  type: string;
  memory?: any; // serializable memory
  model?: string; // model name or reference
  updatedAt?: number;
}

export interface WorldBundle {
  meta: WorldMeta;
  objects: WorldObject[];
  abexos?: Abexo[];
  timeline?: TimelineEvent[];
  snapshots?: Snapshot[];
  assets?: { asset: GLBAsset; blob?: Blob }[];
  agents?: AgentState[];
}
