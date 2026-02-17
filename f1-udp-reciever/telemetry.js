// f1-telemetry-logger.js
// Complete F1 25 telemetry application for monitoring all drivers in real-time
// Version 2.0 - Fixed buffer errors and improved logging speed

const dgram = require('dgram');
const chalk = require('chalk');

// Packet IDs for F1 25
const PACKET_IDS = {
    MOTION: 0,
    SESSION: 1,
    LAP_DATA: 2,
    EVENT: 3,
    PARTICIPANTS: 4,
    CAR_SETUPS: 5,
    CAR_TELEMETRY: 6,
    CAR_STATUS: 7,
    FINAL_CLASSIFICATION: 8,
    LOBBY_INFO: 9,
    CAR_DAMAGE: 10,
    SESSION_HISTORY: 11,
    TYRE_SETS: 12,
    MOTION_EX: 13,
    TIME_TRIAL: 14
};

// Expected packet sizes for validation
const PACKET_SIZES = {
    0: 1349,  // Motion
    1: 644,   // Session  
    2: 1131,  // Lap Data
    3: 45,    // Event
    4: 1306,  // Participants
    5: 1107,  // Car Setups
    6: 1352,  // Car Telemetry
    7: 1239,  // Car Status
    8: 1020,  // Final Classification
    9: 1218,  // Lobby Info
    10: 953,  // Car Damage
    11: 1460, // Session History
    12: 231,  // Tyre Sets
    13: 217,  // Motion Ex
    14: 101   // Time Trial
};

// Driver data storage
const drivers = new Map();
const sessionInfo = {
    trackName: '',
    sessionType: '',
    weather: '',
    trackTemp: 0,
    airTemp: 0,
    totalLaps: 0
};

// Statistics
let packetCount = 0;
let errorCount = 0;
let lastDisplayTime = Date.now();

// UDP server setup
const server = dgram.createSocket('udp4');

// Parse packet header (29 bytes) with validation
function parseHeader(buffer) {
    if (buffer.length < 29) {
        return null;
    }
    
    try {
        return {
            packetFormat: buffer.readUInt16LE(0),      // 2025 for F1 25
            gameYear: buffer.readUInt8(2),             // Game year - last two digits e.g. 25
            gameMajorVersion: buffer.readUInt8(3),     // Game major version
            gameMinorVersion: buffer.readUInt8(4),     // Game minor version
            packetVersion: buffer.readUInt8(5),        // Version of this packet type
            packetId: buffer.readUInt8(6),             // Identifier for packet type
            sessionUID: buffer.readBigUInt64LE(7),     // Unique session identifier
            sessionTime: buffer.readFloatLE(15),       // Session timestamp
            frameIdentifier: buffer.readUInt32LE(19),  // Frame identifier
            overallFrameIdentifier: buffer.readUInt32LE(23), // Overall frame identifier
            playerCarIndex: buffer.readUInt8(27),      // Index of player's car
            secondaryPlayerCarIndex: buffer.readUInt8(28) // Index of secondary player
        };
    } catch (e) {
        return null;
    }
}

// Validate buffer size before reading
function safeReadUInt8(buffer, offset) {
    if (offset < 0 || offset >= buffer.length) {
        return 0;
    }
    return buffer.readUInt8(offset);
}

function safeReadUInt16LE(buffer, offset) {
    if (offset < 0 || offset + 1 >= buffer.length) {
        return 0;
    }
    return buffer.readUInt16LE(offset);
}

function safeReadFloatLE(buffer, offset) {
    if (offset < 0 || offset + 3 >= buffer.length) {
        return 0.0;
    }
    return buffer.readFloatLE(offset);
}

function safeReadString(buffer, offset, length) {
    if (offset < 0 || offset + length > buffer.length) {
        return '';
    }
    const slice = buffer.slice(offset, Math.min(offset + length, buffer.length));
    return slice.toString('utf8').replace(/\0/g, '').trim();
}

// Parse participant data to get driver names
function parseParticipants(buffer) {
    const header = parseHeader(buffer);
    if (!header) return;
    
    // Validate minimum packet size
    if (buffer.length < 1306) {
        console.log(chalk.yellow(`Warning: Participants packet too small (${buffer.length} bytes)`));
        return;
    }
    
    const numActiveCars = safeReadUInt8(buffer, 29);
    const actualCars = Math.min(numActiveCars, 22); // Max 22 cars
    
    let offset = 30;
    for (let i = 0; i < actualCars; i++) {
        // Check if we have enough buffer left
        if (offset + 58 > buffer.length) {
            break;
        }
        
        const aiControlled = safeReadUInt8(buffer, offset) === 1;
        const driverId = safeReadUInt8(buffer, offset + 1);
        const networkId = safeReadUInt8(buffer, offset + 2);
        const teamId = safeReadUInt8(buffer, offset + 3);
        const myTeam = safeReadUInt8(buffer, offset + 4) === 1;
        const raceNumber = safeReadUInt8(buffer, offset + 5);
        const nationality = safeReadUInt8(buffer, offset + 6);
        
        // Read driver name safely
        const name = safeReadString(buffer, offset + 7, 48) || `Driver ${i + 1}`;
        
        const yourTelemetry = safeReadUInt8(buffer, offset + 55);
        const showOnlineNames = safeReadUInt8(buffer, offset + 56) === 1;
        const platform = safeReadUInt8(buffer, offset + 57);
        
        if (!drivers.has(i)) {
            drivers.set(i, {});
        }
        
        drivers.get(i).name = name;
        drivers.get(i).raceNumber = raceNumber;
        drivers.get(i).teamId = teamId;
        drivers.get(i).isPlayer = (i === header.playerCarIndex);
        drivers.get(i).isAI = aiControlled;
        
        offset += 58; // Size of ParticipantData structure
    }
}

// Parse session data
function parseSession(buffer) {
    const header = parseHeader(buffer);
    if (!header) return;
    
    if (buffer.length < 644) {
        console.log(chalk.yellow(`Warning: Session packet too small (${buffer.length} bytes)`));
        return;
    }
    
    let offset = 29;
    
    const weather = safeReadUInt8(buffer, offset);
    const trackTemp = buffer.readInt8 ? buffer.readInt8(offset + 1) : 0;
    const airTemp = buffer.readInt8 ? buffer.readInt8(offset + 2) : 0;
    const totalLaps = safeReadUInt8(buffer, offset + 3);
    const trackLength = safeReadUInt16LE(buffer, offset + 4);
    const sessionType = safeReadUInt8(buffer, offset + 6);
    const trackId = buffer.readInt8 ? buffer.readInt8(offset + 7) : 0;
    
    sessionInfo.weather = getWeatherString(weather);
    sessionInfo.trackTemp = trackTemp;
    sessionInfo.airTemp = airTemp;
    sessionInfo.sessionType = getSessionTypeString(sessionType);
    sessionInfo.totalLaps = totalLaps;
    sessionInfo.trackId = trackId;
}

// Parse car telemetry (speed, throttle, brake, gear, etc.)
function parseCarTelemetry(buffer) {
    const header = parseHeader(buffer);
    if (!header) return;
    
    if (buffer.length < 1352) {
        return;
    }
    
    let offset = 29;
    
    for (let i = 0; i < 22; i++) {
        // Check buffer boundary
        if (offset + 60 > buffer.length) {
            break;
        }
        
        const speed = safeReadUInt16LE(buffer, offset);
        const throttle = safeReadFloatLE(buffer, offset + 2);
        const steer = safeReadFloatLE(buffer, offset + 6);
        const brake = safeReadFloatLE(buffer, offset + 10);
        const clutch = safeReadUInt8(buffer, offset + 14);
        const gear = buffer.readInt8 ? buffer.readInt8(offset + 15) : 0;
        const engineRPM = safeReadUInt16LE(buffer, offset + 16);
        const drs = safeReadUInt8(buffer, offset + 18);
        
        // Brake temperatures (4 wheels)
        const brakesTemp = [
            safeReadUInt16LE(buffer, offset + 22), // RL
            safeReadUInt16LE(buffer, offset + 24), // RR
            safeReadUInt16LE(buffer, offset + 26), // FL
            safeReadUInt16LE(buffer, offset + 28)  // FR
        ];
        
        // Tyre surface temperatures (4 wheels)
        const tyresSurfaceTemp = [
            safeReadUInt8(buffer, offset + 30), // RL
            safeReadUInt8(buffer, offset + 31), // RR
            safeReadUInt8(buffer, offset + 32), // FL
            safeReadUInt8(buffer, offset + 33)  // FR
        ];
        
        const engineTemp = safeReadUInt16LE(buffer, offset + 38);
        
        if (drivers.has(i)) {
            const driver = drivers.get(i);
            driver.telemetry = {
                speed,
                throttle: (throttle * 100).toFixed(1),
                brake: (brake * 100).toFixed(1),
                gear: gear === -1 ? 'R' : gear === 0 ? 'N' : gear,
                engineRPM,
                drs: drs === 1 ? 'ON' : 'OFF',
                engineTemp,
                tyreTemp: Math.round((tyresSurfaceTemp[0] + tyresSurfaceTemp[1] + 
                          tyresSurfaceTemp[2] + tyresSurfaceTemp[3]) / 4),
                brakeTemp: Math.round((brakesTemp[0] + brakesTemp[1] + 
                          brakesTemp[2] + brakesTemp[3]) / 4)
            };
        }
        
        offset += 60; // Size of CarTelemetryData structure
    }
}

// Parse lap data
function parseLapData(buffer) {
    const header = parseHeader(buffer);
    if (!header) return;
    
    if (buffer.length < 1131) {
        return;
    }
    
    let offset = 29;
    
    for (let i = 0; i < 22; i++) {
        // Check buffer boundary
        if (offset + 50 > buffer.length) {
            break;
        }
        
        const lastLapTimeMs = buffer.readUInt32LE ? buffer.readUInt32LE(offset) : 0;
        const currentLapTimeMs = buffer.readUInt32LE ? buffer.readUInt32LE(offset + 4) : 0;
        const carPosition = safeReadUInt8(buffer, offset + 32);
        const currentLapNum = safeReadUInt8(buffer, offset + 33);
        const pitStatus = safeReadUInt8(buffer, offset + 34);
        const penalties = safeReadUInt8(buffer, offset + 38);
        const totalWarnings = safeReadUInt8(buffer, offset + 39);
        const driverStatus = safeReadUInt8(buffer, offset + 44);
        
        if (drivers.has(i)) {
            const driver = drivers.get(i);
            driver.lapData = {
                position: carPosition,
                currentLap: currentLapNum,
                lastLapTime: formatTime(lastLapTimeMs),
                currentLapTime: formatTime(currentLapTimeMs),
                pitStatus: getPitStatusString(pitStatus),
                penalties,
                warnings: totalWarnings,
                driverStatus: getDriverStatusString(driverStatus)
            };
        }
        
        offset += 50; // Reduced size for safety
    }
}

// Parse car status
function parseCarStatus(buffer) {
    const header = parseHeader(buffer);
    if (!header) return;
    
    if (buffer.length < 1239) {
        return;
    }
    
    let offset = 29;
    
    for (let i = 0; i < 22; i++) {
        // Check buffer boundary
        if (offset + 55 > buffer.length) {
            break;
        }
        
        const fuelInTank = safeReadFloatLE(buffer, offset + 5);
        const fuelCapacity = safeReadFloatLE(buffer, offset + 9);
        const fuelRemainingLaps = safeReadFloatLE(buffer, offset + 13);
        const actualTyreCompound = safeReadUInt8(buffer, offset + 25);
        const tyresAgeLaps = safeReadUInt8(buffer, offset + 27);
        const vehicleFiaFlags = buffer.readInt8 ? buffer.readInt8(offset + 28) : 0;
        const ersStoreEnergy = safeReadFloatLE(buffer, offset + 37);
        const ersDeployMode = safeReadUInt8(buffer, offset + 41);
        
        if (drivers.has(i)) {
            const driver = drivers.get(i);
            driver.carStatus = {
                fuel: fuelInTank.toFixed(2),
                fuelLaps: fuelRemainingLaps.toFixed(1),
                tyreCompound: getTyreCompoundString(actualTyreCompound),
                tyreAge: tyresAgeLaps,
                ersEnergy: (ersStoreEnergy / 4000000 * 100).toFixed(1), // Convert to percentage
                ersMode: getERSModeString(ersDeployMode),
                flags: getFlagString(vehicleFiaFlags)
            };
        }
        
        offset += 55; // Size of CarStatusData structure
    }
}

// Helper functions for formatting
function formatTime(milliseconds) {
    if (!milliseconds || milliseconds === 0 || milliseconds > 999999999) return '--:--';
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    const ms = milliseconds % 1000;
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

function getWeatherString(weather) {
    const types = ['Clear', 'Light Cloud', 'Overcast', 'Light Rain', 'Heavy Rain', 'Storm'];
    return types[weather] || 'Unknown';
}

function getSessionTypeString(type) {
    const types = ['Unknown', 'FP1', 'FP2', 'FP3', 'Short FP', 'Q1', 'Q2', 'Q3', 
                   'Short Q', 'OSQ', 'R', 'Sprint Shootout 1', 'Sprint Shootout 2', 
                   'Sprint Shootout 3', 'Short Sprint Shootout', 'R2', 'R3', 'Time Trial'];
    return types[type] || 'Unknown';
}

function getTyreCompoundString(compound) {
    const compounds = {
        16: 'C5', 17: 'C4', 18: 'C3', 19: 'C2', 20: 'C1', 21: 'C0',
        7: 'Inter', 8: 'Wet',
        9: 'Dry', 10: 'Wet', 11: 'Super Soft', 12: 'Soft', 
        13: 'Medium', 14: 'Hard', 15: 'Wet'
    };
    return compounds[compound] || 'Unknown';
}

function getPitStatusString(status) {
    const statuses = ['None', 'Pitting', 'In Pit'];
    return statuses[status] || 'Unknown';
}

function getDriverStatusString(status) {
    const statuses = ['In Garage', 'Flying Lap', 'In Lap', 'Out Lap', 'On Track'];
    return statuses[status] || 'Unknown';
}

function getERSModeString(mode) {
    const modes = ['None', 'Medium', 'Hotlap', 'Overtake'];
    return modes[mode] || 'Unknown';
}

function getFlagString(flag) {
    const flags = {
        '-1': 'Invalid', 0: 'None', 1: 'Green', 2: 'Blue',
        3: 'Yellow', 4: 'Red'
    };
    return flags[flag] || 'None';
}

// Clear console and display data with controlled update rate
function displayTelemetry() {
    const now = Date.now();
    
    // Control update rate - update every 500ms (2 FPS) instead of 100ms
    if (now - lastDisplayTime < 500) {
        return;
    }
    lastDisplayTime = now;
    
    console.clear();
    
    // Display session info
    console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════════════════════════════════'));
    console.log(chalk.cyan.bold(`  F1 25 TELEMETRY - ${sessionInfo.sessionType || 'Waiting'} - Track: ${sessionInfo.trackTemp}°C - Air: ${sessionInfo.airTemp}°C`));
    console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════════════════════════════════'));
    console.log('');
    
    // Display statistics
    console.log(chalk.gray(`Packets: ${packetCount} | Errors: ${errorCount} | Drivers: ${drivers.size}`));
    console.log('');
    
    // Sort drivers by position
    const sortedDrivers = Array.from(drivers.entries())
        .filter(([id, driver]) => driver.lapData && driver.lapData.position > 0)
        .sort((a, b) => (a[1].lapData?.position || 999) - (b[1].lapData?.position || 999));
    
    if (sortedDrivers.length === 0) {
        console.log(chalk.yellow('Waiting for race data... Make sure you are on track.'));
        console.log('');
        console.log(chalk.gray('Press Ctrl+C to stop'));
        return;
    }
    
    // Display header
    console.log(chalk.gray('Pos │ Driver          │ Lap  │ Last Lap    │ Speed │ Gear │ Fuel  │ Tyre    │ Status'));
    console.log(chalk.gray('────┼─────────────────┼──────┼─────────────┼───────┼──────┼───────┼─────────┼────────'));
    
    // Display each driver (limit to top 20 for cleaner display)
    sortedDrivers.slice(0, 20).forEach(([id, driver]) => {
        const lap = driver.lapData || {};
        const telemetry = driver.telemetry || {};
        const status = driver.carStatus || {};
        
        const isPlayer = driver.isPlayer;
        const color = isPlayer ? chalk.yellow : chalk.white;
        const highlight = isPlayer ? chalk.bgYellow.black : (x) => x;
        
        const line = [
            highlight(String(lap.position || '-').padStart(3)),
            color(String(driver.name || 'Unknown').padEnd(15).substring(0, 15)),
            String(lap.currentLap || '-').padStart(4),
            String(lap.lastLapTime || '--:--').padEnd(11),
            String(telemetry.speed || '0').padStart(3) + 'km/h',
            String(telemetry.gear || '-').padStart(4),
            String(status.fuel || '0.0').padStart(5) + 'kg',
            (status.tyreCompound || '---').padEnd(3) + ' ' + String(status.tyreAge || '0').padStart(2) + 'L',
            lap.driverStatus || 'Unknown'
        ].join(' │ ');
        
        console.log(line);
    });
    
    console.log('');
    console.log(chalk.gray('Press Ctrl+C to stop | Updates every 0.5 seconds'));
}

// Update display every 500ms instead of 100ms
let displayInterval;

// Message handler with error handling
server.on('message', (msg, rinfo) => {
    try {
        packetCount++;
        
        // Validate minimum packet size
        if (msg.length < 29) {
            errorCount++;
            return;
        }
        
        const header = parseHeader(msg);
        if (!header) {
            errorCount++;
            return;
        }
        
        // Check if this is F1 25 or F1 24 data
        if (header.packetFormat !== 2025 && header.packetFormat !== 2024) {
            if (errorCount < 5) { // Only show warning first 5 times
                console.log(chalk.red(`Warning: Received packet format ${header.packetFormat}, expected 2025 for F1 25 or 2024 for F1 24`));
            }
            errorCount++;
            return;
        }
        
        // Validate packet size matches expected size
        const expectedSize = PACKET_SIZES[header.packetId];
        if (expectedSize && Math.abs(msg.length - expectedSize) > 50) { // Allow some variance
            // Packet size doesn't match, but try to parse anyway
        }
        
        // Process different packet types with error handling
        try {
            switch (header.packetId) {
                case PACKET_IDS.PARTICIPANTS:
                    parseParticipants(msg);
                    break;
                case PACKET_IDS.SESSION:
                    parseSession(msg);
                    break;
                case PACKET_IDS.LAP_DATA:
                    parseLapData(msg);
                    break;
                case PACKET_IDS.CAR_TELEMETRY:
                    parseCarTelemetry(msg);
                    break;
                case PACKET_IDS.CAR_STATUS:
                    parseCarStatus(msg);
                    break;
            }
        } catch (parseError) {
            errorCount++;
            if (errorCount < 10) { // Only show first 10 errors
                console.log(chalk.red(`Parse error for packet ${header.packetId}: ${parseError.message}`));
            }
        }
    } catch (error) {
        errorCount++;
        if (errorCount < 10) { // Only show first 10 errors
            console.log(chalk.red(`General error: ${error.message}`));
        }
    }
});

// Server error handler
server.on('error', (err) => {
    console.log(chalk.red(`Server error:\n${err.stack}`));
    server.close();
});

// Server listening handler
server.on('listening', () => {
    const address = server.address();
    console.log(chalk.green.bold(`🏁 F1 25 Telemetry Logger Started (v2.0)`));
    console.log(chalk.green(`📡 Listening for UDP packets on ${address.address}:${address.port}`));
    console.log(chalk.yellow(`⚠️  Make sure F1 25/24 telemetry is enabled and set to port ${address.port}`));
    console.log('');
    console.log(chalk.cyan('Waiting for data...'));
    console.log(chalk.gray('Display updates every 0.5 seconds for better readability'));
    console.log('');
    
    // Start display update at 500ms intervals (2 FPS)
    displayInterval = setInterval(displayTelemetry, 500);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n👋 Shutting down telemetry logger...'));
    console.log(chalk.gray(`Total packets received: ${packetCount}`));
    console.log(chalk.gray(`Total errors: ${errorCount}`));
    clearInterval(displayInterval);
    server.close();
    process.exit(0);
});

// Start the server
server.bind(20777, '0.0.0.0');

console.log(chalk.blue.bold('╔════════════════════════════════════════╗'));
console.log(chalk.blue.bold('║     F1 25 TELEMETRY LOGGER v2.0        ║'));
console.log(chalk.blue.bold('║     Real-time All Drivers Monitor      ║'));
console.log(chalk.blue.bold('╚════════════════════════════════════════╝'));