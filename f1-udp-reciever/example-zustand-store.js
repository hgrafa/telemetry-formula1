/**
 * Example Zustand Store for F1 Telemetry Data
 *
 * @description
 * This example shows how to integrate the F1UDPService with Zustand
 * for state management in a React/Next.js application
 *
 * @example Usage in a React component:
 * ```tsx
 * import { useF1Store } from './stores/f1Store';
 *
 * function TelemetryDashboard() {
 *   const {
 *     isConnected,
 *     currentSpeed,
 *     currentGear,
 *     statistics,
 *     startService,
 *     stopService
 *   } = useF1Store();
 *
 *   return (
 *     <div>
 *       <button onClick={isConnected ? stopService : startService}>
 *         {isConnected ? 'Disconnect' : 'Connect'}
 *       </button>
 *       {isConnected && (
 *         <div>
 *           <p>Speed: {currentSpeed} km/h</p>
 *           <p>Gear: {currentGear}</p>
 *           <p>Packets: {statistics.packetsReceived}</p>
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { F1UDPService } from './F1UDPService';

/**
 * TypeScript Interface for the Store
 *
 * @interface F1Store
 */
interface F1Store {
  // Service instance
  service: F1UDPService | null;

  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;

  // Service statistics
  statistics: {
    packetsReceived: number;
    bytesReceived: number;
    packetsPerSecond: number;
    averagePacketsPerSecond: string;
    runtime: string;
    packetCounts: Record<string, number>;
    lastPacketTime: number | null;
  };

  // Latest packet data
  latestPacket: any | null;

  // Session data
  sessionData: {
    sessionUID: bigint | null;
    sessionTime: number;
    sessionType: string;
    trackId: number;
    formula: string;
    weatherId: number;
    totalLaps: number;
    trackLength: number;
    sessionTimeLeft: number;
  };

  // Player car telemetry
  playerTelemetry: {
    speed: number;
    throttle: number;
    brake: number;
    gear: number;
    engineRPM: number;
    drs: boolean;
    revLightsPercent: number;
    brakesTemperature: number[];
    tyresTemperature: number[];
    tyresPressure: number[];
    engineTemperature: number;
  };

  // Player car status
  playerStatus: {
    tractionControl: number;
    antiLockBrakes: boolean;
    fuelMix: number;
    frontBrakeBias: number;
    pitLimiterStatus: boolean;
    fuelInTank: number;
    fuelCapacity: number;
    fuelRemainingLaps: number;
    maxRPM: number;
    idleRPM: number;
    maxGears: number;
    drsAllowed: boolean;
    drsActivationDistance: number;
    tyresWear: number[];
    actualTyreCompound: string;
    visualTyreCompound: string;
    tyresAgeLaps: number;
    tyresDamage: number[];
    ersStoreEnergy: number;
    ersDeployMode: number;
    ersDeployedThisLap: number;
  };

  // Lap data
  lapData: {
    currentLapTime: number;
    currentLapNum: number;
    bestLapTime: number;
    lastLapTime: number;
    sector1Time: number;
    sector2Time: number;
    currentLapDistance: number;
    totalDistance: number;
    carPosition: number;
    currentLapInvalid: boolean;
    penalties: number;
    warnings: number;
    gridPosition: number;
    driverStatus: string;
    resultStatus: string;
  };

  // Motion data
  motionData: {
    worldPositionX: number;
    worldPositionY: number;
    worldPositionZ: number;
    worldVelocityX: number;
    worldVelocityY: number;
    worldVelocityZ: number;
    worldForwardDirX: number;
    worldForwardDirY: number;
    worldForwardDirZ: number;
    worldRightDirX: number;
    worldRightDirY: number;
    worldRightDirZ: number;
    gForceLateral: number;
    gForceLongitudinal: number;
    gForceVertical: number;
    yaw: number;
    pitch: number;
    roll: number;
  };

  // All participants data
  participants: Array<{
    aiControlled: boolean;
    driverId: number;
    networkId: number;
    teamId: number;
    myTeam: boolean;
    raceNumber: number;
    nationality: number;
    name: string;
    yourTelemetry: boolean;
    showOnlineNames: boolean;
    platform: number;
  }>;

  // Events log
  events: Array<{
    eventString: string;
    timestamp: number;
    details: any;
  }>;
  maxEventsLog: number;

  // Actions
  startService: (config?: any) => Promise<void>;
  stopService: () => Promise<void>;
  resetStatistics: () => void;
  clearEvents: () => void;
  setMaxEventsLog: (max: number) => void;

  // Internal actions (not exposed to components)
  _handlePacket: (data: any) => void;
  _handleStatistics: (stats: any) => void;
  _handleError: (error: any) => void;
  _updateSessionData: (data: any) => void;
  _updateTelemetry: (data: any) => void;
  _updateLapData: (data: any) => void;
  _updateMotionData: (data: any) => void;
  _updateParticipants: (data: any) => void;
  _updateCarStatus: (data: any) => void;
  _addEvent: (event: any) => void;
}

/**
 * Create the Zustand store
 */
const useF1Store = create<F1Store>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // Initial state
      service: null,
      isConnected: false,
      isConnecting: false,
      connectionError: null,

      statistics: {
        packetsReceived: 0,
        bytesReceived: 0,
        packetsPerSecond: 0,
        averagePacketsPerSecond: '0',
        runtime: '0',
        packetCounts: {},
        lastPacketTime: null,
      },

      latestPacket: null,

      sessionData: {
        sessionUID: null,
        sessionTime: 0,
        sessionType: '',
        trackId: 0,
        formula: '',
        weatherId: 0,
        totalLaps: 0,
        trackLength: 0,
        sessionTimeLeft: 0,
      },

      playerTelemetry: {
        speed: 0,
        throttle: 0,
        brake: 0,
        gear: 0,
        engineRPM: 0,
        drs: false,
        revLightsPercent: 0,
        brakesTemperature: [0, 0, 0, 0],
        tyresTemperature: [0, 0, 0, 0],
        tyresPressure: [0, 0, 0, 0],
        engineTemperature: 0,
      },

      playerStatus: {
        tractionControl: 0,
        antiLockBrakes: false,
        fuelMix: 0,
        frontBrakeBias: 0,
        pitLimiterStatus: false,
        fuelInTank: 0,
        fuelCapacity: 0,
        fuelRemainingLaps: 0,
        maxRPM: 0,
        idleRPM: 0,
        maxGears: 0,
        drsAllowed: false,
        drsActivationDistance: 0,
        tyresWear: [0, 0, 0, 0],
        actualTyreCompound: '',
        visualTyreCompound: '',
        tyresAgeLaps: 0,
        tyresDamage: [0, 0, 0, 0],
        ersStoreEnergy: 0,
        ersDeployMode: 0,
        ersDeployedThisLap: 0,
      },

      lapData: {
        currentLapTime: 0,
        currentLapNum: 0,
        bestLapTime: 0,
        lastLapTime: 0,
        sector1Time: 0,
        sector2Time: 0,
        currentLapDistance: 0,
        totalDistance: 0,
        carPosition: 0,
        currentLapInvalid: false,
        penalties: 0,
        warnings: 0,
        gridPosition: 0,
        driverStatus: '',
        resultStatus: '',
      },

      motionData: {
        worldPositionX: 0,
        worldPositionY: 0,
        worldPositionZ: 0,
        worldVelocityX: 0,
        worldVelocityY: 0,
        worldVelocityZ: 0,
        worldForwardDirX: 0,
        worldForwardDirY: 0,
        worldForwardDirZ: 0,
        worldRightDirX: 0,
        worldRightDirY: 0,
        worldRightDirZ: 0,
        gForceLateral: 0,
        gForceLongitudinal: 0,
        gForceVertical: 0,
        yaw: 0,
        pitch: 0,
        roll: 0,
      },

      participants: [],
      events: [],
      maxEventsLog: 100,

      // Actions
      startService: async (config = {}) => {
        const state = get();

        if (state.isConnected || state.isConnecting) {
          return;
        }

        set({ isConnecting: true, connectionError: null });

        try {
          const service = new F1UDPService(config);

          // Setup event listeners
          service.on('packet', (data) => state._handlePacket(data));
          service.on('stats', (stats) => state._handleStatistics(stats));
          service.on('error', (error) => state._handleError(error));

          // Specific packet handlers
          service.on('packet:session', (data) => state._updateSessionData(data));
          service.on('packet:cartelemetry', (data) => state._updateTelemetry(data));
          service.on('packet:lapdata', (data) => state._updateLapData(data));
          service.on('packet:motion', (data) => state._updateMotionData(data));
          service.on('packet:participants', (data) => state._updateParticipants(data));
          service.on('packet:carstatus', (data) => state._updateCarStatus(data));
          service.on('packet:event', (data) => state._addEvent(data));

          await service.start();

          set({
            service,
            isConnected: true,
            isConnecting: false,
          });
        } catch (error) {
          set({
            isConnecting: false,
            connectionError: error.message,
          });
        }
      },

      stopService: async () => {
        const { service } = get();

        if (service && service.isServiceRunning()) {
          await service.stop();
          set({
            service: null,
            isConnected: false,
            connectionError: null,
          });
        }
      },

      resetStatistics: () => {
        const { service } = get();
        if (service) {
          service.resetStatistics();
        }
        set({
          statistics: {
            packetsReceived: 0,
            bytesReceived: 0,
            packetsPerSecond: 0,
            averagePacketsPerSecond: '0',
            runtime: '0',
            packetCounts: {},
            lastPacketTime: null,
          },
        });
      },

      clearEvents: () => {
        set({ events: [] });
      },

      setMaxEventsLog: (max: number) => {
        set({ maxEventsLog: max });
      },

      // Internal handlers
      _handlePacket: (data) => {
        set({ latestPacket: data });
      },

      _handleStatistics: (stats) => {
        set({ statistics: stats });
      },

      _handleError: (error) => {
        set({ connectionError: error.message || 'Unknown error' });
        console.error('F1 UDP Service Error:', error);
      },

      _updateSessionData: (data) => {
        // Parse session packet data
        // This would need proper packet parsing implementation
        set((state) => ({
          sessionData: {
            ...state.sessionData,
            sessionUID: data.header.sessionUID,
            sessionTime: data.header.sessionTime,
            // Add more parsed fields here
          },
        }));
      },

      _updateTelemetry: (data) => {
        // Parse telemetry packet data
        // This would need proper packet parsing implementation
        set((state) => ({
          playerTelemetry: {
            ...state.playerTelemetry,
            // Add parsed telemetry fields here
          },
        }));
      },

      _updateLapData: (data) => {
        // Parse lap data packet
        // This would need proper packet parsing implementation
        set((state) => ({
          lapData: {
            ...state.lapData,
            // Add parsed lap data fields here
          },
        }));
      },

      _updateMotionData: (data) => {
        // Parse motion packet data
        // This would need proper packet parsing implementation
        set((state) => ({
          motionData: {
            ...state.motionData,
            // Add parsed motion fields here
          },
        }));
      },

      _updateParticipants: (data) => {
        // Parse participants packet data
        // This would need proper packet parsing implementation
        set({ participants: [] }); // Add parsed participants
      },

      _updateCarStatus: (data) => {
        // Parse car status packet data
        // This would need proper packet parsing implementation
        set((state) => ({
          playerStatus: {
            ...state.playerStatus,
            // Add parsed status fields here
          },
        }));
      },

      _addEvent: (eventData) => {
        set((state) => {
          const event = {
            eventString: eventData.header.packetId.toString(),
            timestamp: eventData.timestamp,
            details: eventData,
          };

          const events = [event, ...state.events].slice(0, state.maxEventsLog);

          return { events };
        });
      },
    })),
    {
      name: 'f1-telemetry-store',
    }
  )
);

export { useF1Store };
export type { F1Store };