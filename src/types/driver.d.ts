export interface Driver {
  id: number;
  name: string;
  raceNumber: number;
  teamId: number;
  isPlayer: boolean;
  isAI: boolean;
  telemetry?: DriverTelemetry;
  lapData?: DriverLapData;
  carStatus?: DriverCarStatus;
}

export interface DriverTelemetry {
  speed: number;
  throttle: string;
  brake: string;
  gear: string | number;
  engineRPM: number;
  drs: 'ON' | 'OFF';
  engineTemp: number;
  tyreTemp: number;
  brakeTemp: number;
}