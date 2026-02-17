// Definições de tipos para todos os pacotes F1 25
export interface PacketHeader {
  packetFormat: number ;      // 2025 for F1 25, 2024 for F1 24
  gameYear: number;           // Last two digits e.g. 25
  gameMajorVersion: number;
  gameMinorVersion: number;
  packetVersion: number;
  packetId: number;
  sessionUID: bigint;
  sessionTime: number;
  frameIdentifier: number;
  overallFrameIdentifier: number;
  playerCarIndex: number;
  secondaryPlayerCarIndex: number;
}

export enum PacketTypes {
  MOTION,
  SESSION,
  LAP_DATA,
  EVENT,
  PARTICIPANTS,
  CAR_SETUPS,
  CAR_TELEMETRY,
  CAR_STATUS,
  FINAL_CLASSIFICATION,
  LOBBY_INFO,
  CAR_DAMAGE,
  SESSION_HISTORY,
  TYRE_SETS,
  MOTION_EX,
  TIME_TRIAL,
}

export interface PacketSizes {
  [PacketTypes.MOTION]: 1349;
  [PacketTypes.SESSION]: 644;
  // TODO: Completar com outros valores de pacote se necessario
}