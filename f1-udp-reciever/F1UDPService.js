/**
 * F1 25 UDP Telemetry Service
 *
 * @description
 * A modular, event-driven service for receiving and parsing F1 25 UDP telemetry data.
 * Designed to be used with TypeScript and state management libraries like Zustand.
 *
 * @example
 * ```javascript
 * const { F1UDPService } = require('./F1UDPService');
 *
 * const service = new F1UDPService({ port: 20777 });
 *
 * // Listen to all packets
 * service.on('packet', (data) => {
 *   console.log(`Received ${data.packetType} packet`);
 *   // Update your Zustand store here
 *   useStore.setState({ telemetryData: data });
 * });
 *
 * // Listen to specific packet types
 * service.on('packet:motion', (data) => {
 *   // Handle motion data
 * });
 *
 * // Start the service
 * await service.start();
 * ```
 *
 * @module F1UDPService
 * @author Your Name
 * @version 1.0.0
 */

const dgram = require('dgram');
const EventEmitter = require('events');

/**
 * Packet type definitions for F1 25
 * Maps packet ID to human-readable packet type name
 *
 * @constant {Object.<number, string>}
 * @readonly
 */
const PACKET_TYPES = {
    0: 'Motion',           // Contains all motion data for player's car – only sent while player is in control
    1: 'Session',          // Data about the session – track, time left
    2: 'LapData',          // Data about all the lap times of cars in the session
    3: 'Event',            // Various notable events that happen during a session
    4: 'Participants',     // List of participants in the session, mostly relevant for multiplayer
    5: 'CarSetups',        // Packet detailing car setups for cars in the race
    6: 'CarTelemetry',     // Telemetry data for all cars
    7: 'CarStatus',        // Status data for all cars
    8: 'FinalClassification', // Final classification confirmation at the end of a race
    9: 'LobbyInfo',        // Information about players in a multiplayer lobby
    10: 'CarDamage',       // Damage status for all cars
    11: 'SessionHistory',  // Lap and tyre data for session
    12: 'TyreSets',        // Extended tyre set data
    13: 'MotionEx',        // Extended motion data for player car
    14: 'TimeTrial'        // Time trial stats
};

/**
 * @typedef {Object} ServiceConfig
 * @property {number} [port=20777] - UDP port to listen on
 * @property {string} [address='0.0.0.0'] - IP address to bind to
 * @property {number} [bufferSize=4194304] - UDP receive buffer size in bytes (default 4MB)
 * @property {boolean} [forwardingEnabled=false] - Enable packet forwarding to another address
 * @property {string} [forwardingAddress='127.0.0.1'] - Address to forward packets to
 * @property {number} [forwardingPort=20778] - Port to forward packets to
 */

/**
 * @typedef {Object} PacketHeader
 * @property {number} packetFormat - Packet format (2025 for F1 25)
 * @property {number} gameYear - Game year - last two digits e.g. 25
 * @property {number} gameMajorVersion - Game major version - "X.00"
 * @property {number} gameMinorVersion - Game minor version - "1.XX"
 * @property {number} packetVersion - Version of this packet type
 * @property {number} packetId - Identifier for packet type (see PACKET_TYPES)
 * @property {bigint} sessionUID - Unique identifier for the session
 * @property {number} sessionTime - Session timestamp
 * @property {number} frameIdentifier - Identifier for the frame the packet was retrieved on
 * @property {number} overallFrameIdentifier - Overall identifier for the frame
 * @property {number} playerCarIndex - Index of player's car in the array
 * @property {number} secondaryPlayerCarIndex - Index of secondary player's car (split-screen)
 */

/**
 * @typedef {Object} PacketData
 * @property {string} packetType - Human-readable packet type name
 * @property {Buffer} buffer - Raw packet buffer
 * @property {Object} rinfo - Remote info (address, port)
 * @property {number} timestamp - Local timestamp when packet was received
 * @property {PacketHeader} header - Parsed packet header
 */

/**
 * @typedef {Object} ServiceStatistics
 * @property {number} packetsReceived - Total packets received
 * @property {number} bytesReceived - Total bytes received
 * @property {number} packetsPerSecond - Current packets per second rate
 * @property {string} averagePacketsPerSecond - Average packets per second since start
 * @property {string} runtime - Service runtime in seconds
 * @property {Object.<string, number>} packetCounts - Count of each packet type received
 * @property {number|null} lastPacketTime - Timestamp of last received packet
 * @property {boolean} isRunning - Whether service is currently running
 */

/**
 * F1 UDP Telemetry Service Class
 *
 * @class F1UDPService
 * @extends EventEmitter
 *
 * @fires F1UDPService#listening - Service started listening
 * @fires F1UDPService#packet - Any packet received
 * @fires F1UDPService#packet:motion - Motion packet received
 * @fires F1UDPService#packet:session - Session packet received
 * @fires F1UDPService#packet:lapdata - Lap data packet received
 * @fires F1UDPService#packet:event - Event packet received
 * @fires F1UDPService#packet:participants - Participants packet received
 * @fires F1UDPService#packet:carsetups - Car setups packet received
 * @fires F1UDPService#packet:cartelemetry - Car telemetry packet received
 * @fires F1UDPService#packet:carstatus - Car status packet received
 * @fires F1UDPService#packet:finalclassification - Final classification packet received
 * @fires F1UDPService#packet:lobbyinfo - Lobby info packet received
 * @fires F1UDPService#packet:cardamage - Car damage packet received
 * @fires F1UDPService#packet:sessionhistory - Session history packet received
 * @fires F1UDPService#packet:tyresets - Tyre sets packet received
 * @fires F1UDPService#packet:motionex - Extended motion packet received
 * @fires F1UDPService#packet:timetrial - Time trial packet received
 * @fires F1UDPService#stats - Statistics update (every second)
 * @fires F1UDPService#error - Error occurred
 * @fires F1UDPService#warning - Warning message
 * @fires F1UDPService#stopped - Service stopped
 * @fires F1UDPService#invalidPacket - Invalid packet received
 */
class F1UDPService extends EventEmitter {
    /**
     * Create a new F1 UDP Service instance
     *
     * @constructor
     * @param {ServiceConfig} [options={}] - Service configuration options
     *
     * @example
     * ```javascript
     * const service = new F1UDPService({
     *   port: 20777,
     *   forwardingEnabled: true,
     *   forwardingPort: 20778
     * });
     * ```
     */
    constructor(options = {}) {
        super();

        /** @type {ServiceConfig} */
        this.config = {
            port: options.port || 20777,
            address: options.address || '0.0.0.0',
            bufferSize: options.bufferSize || 4 * 1024 * 1024,
            forwardingEnabled: options.forwardingEnabled || false,
            forwardingAddress: options.forwardingAddress || '127.0.0.1',
            forwardingPort: options.forwardingPort || 20778
        };

        /** @type {dgram.Socket|null} */
        this.socket = null;

        /** @type {dgram.Socket|null} */
        this.forwardSocket = null;

        /** @type {boolean} */
        this.isRunning = false;

        /** @type {ServiceStatistics} */
        this.stats = {
            packetsReceived: 0,
            bytesReceived: 0,
            sessionStartTime: null,
            lastPacketTime: null,
            packetsPerSecond: 0,
            packetCounts: {}
        };

        /** @private */
        this._packetRateInterval = null;
        /** @private */
        this._packetRateCounter = 0;
    }

    /**
     * Start the UDP service and begin listening for packets
     *
     * @async
     * @returns {Promise<void>} Resolves when service is listening
     * @throws {Error} If service is already running
     *
     * @example
     * ```javascript
     * try {
     *   await service.start();
     *   console.log('Service started successfully');
     * } catch (error) {
     *   console.error('Failed to start service:', error);
     * }
     * ```
     */
    async start() {
        if (this.isRunning) {
            throw new Error('Service is already running');
        }

        return new Promise((resolve, reject) => {
            this.socket = dgram.createSocket('udp4');

            // Setup forwarding socket if enabled
            if (this.config.forwardingEnabled) {
                this.forwardSocket = dgram.createSocket('udp4');
            }

            // Setup error handling
            this.socket.on('error', (err) => {
                this.emit('error', err);
                reject(err);
            });

            // Setup message handling
            this.socket.on('message', (msg, rinfo) => {
                this._handleMessage(msg, rinfo);
            });

            // Setup listening event
            this.socket.on('listening', () => {
                const address = this.socket.address();

                // Try to optimize buffer size
                try {
                    this.socket.setRecvBufferSize(this.config.bufferSize);
                } catch (err) {
                    this.emit('warning', 'Could not set UDP buffer size');
                }

                this.isRunning = true;
                this.stats.sessionStartTime = Date.now();
                this._startPacketRateMonitor();

                /**
                 * Listening event
                 * @event F1UDPService#listening
                 * @type {Object}
                 * @property {string} address - Listening address
                 * @property {number} port - Listening port
                 */
                this.emit('listening', {
                    address: address.address,
                    port: address.port
                });

                resolve();
            });

            // Bind socket
            this.socket.bind(this.config.port, this.config.address);
        });
    }

    /**
     * Stop the UDP service
     *
     * @async
     * @returns {Promise<void>} Resolves when service is stopped
     * @throws {Error} If service is not running
     *
     * @example
     * ```javascript
     * await service.stop();
     * console.log('Service stopped');
     * ```
     */
    async stop() {
        if (!this.isRunning) {
            throw new Error('Service is not running');
        }

        return new Promise((resolve) => {
            this._stopPacketRateMonitor();

            // Close forwarding socket if exists
            if (this.forwardSocket) {
                this.forwardSocket.close();
                this.forwardSocket = null;
            }

            this.socket.close(() => {
                this.isRunning = false;
                this.socket = null;

                /**
                 * Stopped event
                 * @event F1UDPService#stopped
                 */
                this.emit('stopped');
                resolve();
            });
        });
    }

    /**
     * Handle incoming UDP message
     *
     * @private
     * @param {Buffer} msg - Raw UDP message buffer
     * @param {Object} rinfo - Remote info (address, port, etc)
     */
    _handleMessage(msg, rinfo) {
        const now = Date.now();

        // Update statistics
        this.stats.packetsReceived++;
        this.stats.bytesReceived += msg.length;
        this.stats.lastPacketTime = now;
        this._packetRateCounter++;

        // Parse packet header
        const header = this._parsePacketHeader(msg);

        if (!header) {
            /**
             * Invalid packet event
             * @event F1UDPService#invalidPacket
             * @type {Object}
             * @property {Buffer} buffer - Raw packet buffer
             * @property {Object} rinfo - Remote info
             */
            this.emit('invalidPacket', { buffer: msg, rinfo });
            return;
        }

        // Update packet type statistics
        const packetTypeName = PACKET_TYPES[header.packetId] || 'Unknown';
        this.stats.packetCounts[packetTypeName] = (this.stats.packetCounts[packetTypeName] || 0) + 1;

        // Create packet data object
        /** @type {PacketData} */
        const packetData = {
            packetType: packetTypeName,
            buffer: msg,
            rinfo,
            timestamp: now,
            header
        };

        // Forward packet if enabled
        if (this.config.forwardingEnabled && this.forwardSocket) {
            this.forwardSocket.send(
                msg,
                this.config.forwardingPort,
                this.config.forwardingAddress
            );
        }

        /**
         * Generic packet event
         * @event F1UDPService#packet
         * @type {PacketData}
         */
        this.emit('packet', packetData);

        /**
         * Specific packet type event
         * @event F1UDPService#packet:*
         * @type {PacketData}
         */
        this.emit(`packet:${packetTypeName.toLowerCase()}`, packetData);
    }

    /**
     * Parse packet header from buffer
     *
     * @private
     * @param {Buffer} buffer - Raw packet buffer
     * @returns {PacketHeader|null} Parsed header data or null if invalid
     */
    _parsePacketHeader(buffer) {
        // F1 25 packet header is 29 bytes
        if (buffer.length < 29) {
            return null;
        }

        try {
            /** @type {PacketHeader} */
            const header = {
                packetFormat: buffer.readUInt16LE(0),
                gameYear: buffer.readUInt8(2),
                gameMajorVersion: buffer.readUInt8(3),
                gameMinorVersion: buffer.readUInt8(4),
                packetVersion: buffer.readUInt8(5),
                packetId: buffer.readUInt8(6),
                sessionUID: buffer.readBigUInt64LE(7),
                sessionTime: buffer.readFloatLE(15),
                frameIdentifier: buffer.readUInt32LE(19),
                overallFrameIdentifier: buffer.readUInt32LE(23),
                playerCarIndex: buffer.readUInt8(27),
                secondaryPlayerCarIndex: buffer.readUInt8(28)
            };

            // Validate packet format (should be 2025 for F1 25)
            if (header.packetFormat !== 2025) {
                this.emit('warning', `Unexpected packet format: ${header.packetFormat}`);
            }

            return header;
        } catch (error) {
            return null;
        }
    }

    /**
     * Start packet rate monitoring
     * Updates statistics every second
     *
     * @private
     */
    _startPacketRateMonitor() {
        this._packetRateInterval = setInterval(() => {
            this.stats.packetsPerSecond = this._packetRateCounter;
            this._packetRateCounter = 0;

            /**
             * Statistics update event
             * @event F1UDPService#stats
             * @type {ServiceStatistics}
             */
            this.emit('stats', this.getStatistics());
        }, 1000);
    }

    /**
     * Stop packet rate monitoring
     *
     * @private
     */
    _stopPacketRateMonitor() {
        if (this._packetRateInterval) {
            clearInterval(this._packetRateInterval);
            this._packetRateInterval = null;
        }
    }

    /**
     * Get current service statistics
     *
     * @returns {ServiceStatistics} Current service statistics
     *
     * @example
     * ```javascript
     * const stats = service.getStatistics();
     * console.log(`Received ${stats.packetsReceived} packets`);
     * console.log(`Current rate: ${stats.packetsPerSecond} pps`);
     * ```
     */
    getStatistics() {
        const now = Date.now();
        const runtime = this.stats.sessionStartTime
            ? (now - this.stats.sessionStartTime) / 1000
            : 0;

        return {
            packetsReceived: this.stats.packetsReceived,
            bytesReceived: this.stats.bytesReceived,
            packetsPerSecond: this.stats.packetsPerSecond,
            averagePacketsPerSecond: runtime > 0
                ? (this.stats.packetsReceived / runtime).toFixed(2)
                : '0',
            runtime: runtime.toFixed(2),
            packetCounts: { ...this.stats.packetCounts },
            lastPacketTime: this.stats.lastPacketTime,
            isRunning: this.isRunning
        };
    }

    /**
     * Reset all statistics to initial values
     *
     * @example
     * ```javascript
     * service.resetStatistics();
     * console.log('Statistics reset');
     * ```
     */
    resetStatistics() {
        this.stats = {
            packetsReceived: 0,
            bytesReceived: 0,
            sessionStartTime: Date.now(),
            lastPacketTime: null,
            packetsPerSecond: 0,
            packetCounts: {}
        };
        this._packetRateCounter = 0;

        /**
         * Statistics reset event
         * @event F1UDPService#statsReset
         */
        this.emit('statsReset');
    }

    /**
     * Get available packet types
     *
     * @static
     * @returns {Object.<number, string>} Map of packet IDs to names
     */
    static getPacketTypes() {
        return { ...PACKET_TYPES };
    }

    /**
     * Check if service is currently running
     *
     * @returns {boolean} True if service is running
     */
    isServiceRunning() {
        return this.isRunning;
    }

    /**
     * Get current configuration
     *
     * @returns {ServiceConfig} Current service configuration
     */
    getConfiguration() {
        return { ...this.config };
    }
}

// Export the service class and constants
module.exports = {
    F1UDPService,
    PACKET_TYPES
};

/**
 * TypeScript declarations for better IDE support
 * Save this as F1UDPService.d.ts
 *
 * @example
 * ```typescript
 * export interface ServiceConfig {
 *   port?: number;
 *   address?: string;
 *   bufferSize?: number;
 *   forwardingEnabled?: boolean;
 *   forwardingAddress?: string;
 *   forwardingPort?: number;
 * }
 *
 * export interface PacketHeader {
 *   packetFormat: number;
 *   gameYear: number;
 *   gameMajorVersion: number;
 *   gameMinorVersion: number;
 *   packetVersion: number;
 *   packetId: number;
 *   sessionUID: bigint;
 *   sessionTime: number;
 *   frameIdentifier: number;
 *   overallFrameIdentifier: number;
 *   playerCarIndex: number;
 *   secondaryPlayerCarIndex: number;
 * }
 *
 * export interface PacketData {
 *   packetType: string;
 *   buffer: Buffer;
 *   rinfo: any;
 *   timestamp: number;
 *   header: PacketHeader;
 * }
 *
 * export interface ServiceStatistics {
 *   packetsReceived: number;
 *   bytesReceived: number;
 *   packetsPerSecond: number;
 *   averagePacketsPerSecond: string;
 *   runtime: string;
 *   packetCounts: Record<string, number>;
 *   lastPacketTime: number | null;
 *   isRunning: boolean;
 * }
 *
 * export declare class F1UDPService extends EventEmitter {
 *   constructor(options?: ServiceConfig);
 *   start(): Promise<void>;
 *   stop(): Promise<void>;
 *   getStatistics(): ServiceStatistics;
 *   resetStatistics(): void;
 *   isServiceRunning(): boolean;
 *   getConfiguration(): ServiceConfig;
 *   static getPacketTypes(): Record<number, string>;
 * }
 * ```
 */