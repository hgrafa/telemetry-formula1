// F1 25 Interactive Data Capture Tool
const dgram = require('dgram');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const chalk = require('chalk');
const server = dgram.createSocket('udp4');

// Recording states
const RecordState = {
    IDLE: 'idle',
    RECORDING: 'recording',
    PAUSED: 'paused',
    FINISHED: 'finished'
};

let currentState = RecordState.IDLE;
let writeStream = null;
let currentTempFile = null;
let currentSessionFile = null;

// Stats
let packetCount = 0;
let dataSize = 0;
let sessionStartTime = 0;
let lastStatusUpdate = Date.now();
let lastPacketTime = 0;
let maxGap = 0;
let droppedPackets = 0;
const packetStats = {};

// Performance monitoring
let writeQueue = [];
let isWriting = false;

// Animation frames for recording indicator
const recordingFrames = ['⚫', '🔴', '⚫', '🔴'];
let animationIndex = 0;

// Setup readline for keyboard input
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
}

const dataDir = path.join(__dirname, 'captured_data');
const tempDir = path.join(__dirname, 'temp_sessions');

// Create directories if they don't exist
[dataDir, tempDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

const packetTypes = [
    'Motion', 'Session', 'Lap Data', 'Event', 'Participants',
    'Car Setups', 'Car Telemetry', 'Car Status', 'Final Classification',
    'Lobby Info', 'Car Damage', 'Session History', 'Tyre Sets',
    'Motion Ex', 'Time Trial'
];

// Clear console and show header
function showHeader() {
    console.clear();
    console.log(chalk.bold.red('═══════════════════════════════════════════════════════════════'));
    console.log(chalk.bold.white('   🏁 F1 25 ') + chalk.bold.yellow('INTERACTIVE DATA CAPTURE TOOL') + chalk.bold.white(' 🏁'));
    console.log(chalk.bold.red('═══════════════════════════════════════════════════════════════'));
    console.log(chalk.cyan(`📡 UDP Server listening on port ${chalk.bold.yellow('20777')}...`));
    console.log(chalk.gray('───────────────────────────────────────────────────────────────\n'));
}

function getStatusBadge() {
    switch(currentState) {
        case RecordState.IDLE:
            return chalk.gray('⚪ IDLE - Ready to record');
        case RecordState.RECORDING:
            return chalk.red(`${recordingFrames[animationIndex]} RECORDING - Capturing data`);
        case RecordState.PAUSED:
            return chalk.yellow('⏸️  PAUSED - Recording suspended');
        case RecordState.FINISHED:
            return chalk.green('✅ FINISHED - Ready to save');
    }
}

function showControls() {
    console.log(chalk.bold.white('\n⌨️  KEYBOARD CONTROLS:'));
    console.log(chalk.gray('───────────────────────────────────────────────────────────────'));
    
    const controls = [
        { key: 'R', desc: 'Start new recording', color: 'green' },
        { key: 'F', desc: 'Finish current recording', color: 'yellow' },
        { key: 'S', desc: 'Save finished recording', color: 'cyan' },
        { key: 'D', desc: 'Delete/discard recording', color: 'red' },
        { key: 'P', desc: 'Pause/Resume recording', color: 'magenta' },
        { key: 'H', desc: 'Show this help', color: 'blue' },
        { key: 'Q', desc: 'Quit application', color: 'gray' }
    ];
    
    controls.forEach(ctrl => {
        console.log(`   ${chalk.bold[ctrl.color](`[${ctrl.key}]`)} ${chalk.white(ctrl.desc)}`);
    });
    
    console.log(chalk.gray('───────────────────────────────────────────────────────────────\n'));
}

function updateDisplay() {
    console.clear();
    showHeader();
    
    // Current status with big visual indicator
    console.log(chalk.bold.white('📊 CURRENT STATUS:'));
    console.log(chalk.gray('───────────────────────────────────────────────────────────────'));
    console.log(`   ${getStatusBadge()}`);
    console.log(chalk.gray('───────────────────────────────────────────────────────────────\n'));
    
    // Session stats if recording/paused/finished
    if (currentState !== RecordState.IDLE && packetCount > 0) {
        const elapsed = sessionStartTime > 0 ? (Date.now() - sessionStartTime) / 1000 : 0;
        const actualRate = elapsed > 0 ? packetCount / elapsed : 0;
        const efficiency = Math.min(100, (actualRate / 20 * 100)).toFixed(1);
        
        console.log(chalk.bold.white('📈 SESSION STATISTICS:'));
        console.log(chalk.gray('───────────────────────────────────────────────────────────────'));
        console.log(`   ⏱️  Duration: ${chalk.bold.yellow(elapsed.toFixed(1) + 's')}`);
        console.log(`   📦 Packets: ${chalk.bold.cyan(packetCount.toLocaleString())}`);
        console.log(`   💾 Data Size: ${chalk.bold.green((dataSize / 1024 / 1024).toFixed(2) + ' MB')}`);
        console.log(`   📊 Capture Rate: ${chalk.bold.magenta(actualRate.toFixed(1) + ' Hz')} (${getEfficiencyColor(efficiency)})`);
        console.log(`   🎯 Write Queue: ${getQueueColor(writeQueue.length)}`);
        
        if (droppedPackets > 0) {
            console.log(`   ⚠️  Dropped: ${chalk.bold.red(droppedPackets)} packets`);
        }
        
        // Packet type breakdown
        if (Object.keys(packetStats).length > 0) {
            console.log(chalk.gray('\n   Packet Types Received:'));
            const sortedStats = Object.entries(packetStats)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);
            
            sortedStats.forEach(([type, count]) => {
                const percentage = ((count / packetCount) * 100).toFixed(1);
                const bar = getProgressBar(percentage);
                console.log(`   ${bar} ${type}: ${chalk.bold(count)} (${percentage}%)`);
            });
        }
        console.log(chalk.gray('───────────────────────────────────────────────────────────────\n'));
    }
    
    // Current file info
    if (currentTempFile) {
        console.log(chalk.bold.white('📁 FILE INFORMATION:'));
        console.log(chalk.gray('───────────────────────────────────────────────────────────────'));
        if (currentState === RecordState.FINISHED) {
            console.log(`   ${chalk.green('✅')} Recording complete: ${chalk.bold.yellow(path.basename(currentTempFile))}`);
            console.log(`   ${chalk.cyan('💡')} Press ${chalk.bold.green('[S]')} to save or ${chalk.bold.red('[D]')} to discard`);
        } else {
            console.log(`   ${chalk.yellow('📝')} Temp file: ${chalk.bold.gray(path.basename(currentTempFile))}`);
        }
        console.log(chalk.gray('───────────────────────────────────────────────────────────────\n'));
    }
    
    showControls();
    
    // Big visual state indicator
    if (currentState === RecordState.RECORDING) {
        console.log(chalk.bold.red.bgRed('                                                                '));
        console.log(chalk.bold.white.bgRed('              🔴 RECORDING IN PROGRESS 🔴                      '));
        console.log(chalk.bold.red.bgRed('                                                                '));
    } else if (currentState === RecordState.PAUSED) {
        console.log(chalk.bold.yellow.bgYellow('                                                                '));
        console.log(chalk.bold.black.bgYellow('              ⏸️  RECORDING PAUSED ⏸️                           '));
        console.log(chalk.bold.yellow.bgYellow('                                                                '));
    } else if (currentState === RecordState.FINISHED) {
        console.log(chalk.bold.green.bgGreen('                                                                '));
        console.log(chalk.bold.white.bgGreen('              ✅ RECORDING COMPLETE ✅                         '));
        console.log(chalk.bold.green.bgGreen('                                                                '));
    } else {
        console.log(chalk.gray('───────────────────────────────────────────────────────────────'));
        console.log(chalk.gray.italic('   Press [R] to start recording...'));
        console.log(chalk.gray('───────────────────────────────────────────────────────────────'));
    }
}

function getEfficiencyColor(efficiency) {
    const eff = parseFloat(efficiency);
    if (eff >= 95) return chalk.bold.green(`${efficiency}% - Excellent`);
    if (eff >= 85) return chalk.bold.yellow(`${efficiency}% - Good`);
    if (eff >= 70) return chalk.bold.magenta(`${efficiency}% - Fair`);
    return chalk.bold.red(`${efficiency}% - Poor`);
}

function getQueueColor(queueSize) {
    if (queueSize === 0) return chalk.bold.green('0 - Clear');
    if (queueSize < 10) return chalk.bold.yellow(`${queueSize} - Normal`);
    if (queueSize < 50) return chalk.bold.magenta(`${queueSize} - High`);
    return chalk.bold.red(`${queueSize} - Critical`);
}

function getProgressBar(percentage) {
    const filled = Math.round(percentage / 10);
    const empty = 10 - filled;
    return chalk.cyan('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
}

// Initial display
showHeader();
showControls();

// Optimized write function with queue
function processWriteQueue() {
    if (!writeStream || isWriting || writeQueue.length === 0) return;
    
    isWriting = true;
    const batch = writeQueue.splice(0, Math.min(100, writeQueue.length));
    
    const buffers = [];
    batch.forEach(({ metadata, data }) => {
        buffers.push(metadata, data);
    });
    
    const combined = Buffer.concat(buffers);
    
    writeStream.write(combined, (err) => {
        isWriting = false;
        if (err) {
            console.error(chalk.red('\n❌ Write error:'), err);
            droppedPackets += batch.length;
        }
        processWriteQueue();
    });
}

function startNewRecording() {
    if (currentState === RecordState.RECORDING) {
        console.log(chalk.yellow('\n⚠️  Already recording! Press [F] to finish first.\n'));
        setTimeout(updateDisplay, 2000);
        return;
    }
    
    // Clean up any previous session
    if (writeStream) {
        writeStream.end();
    }
    
    // Reset stats
    packetCount = 0;
    dataSize = 0;
    sessionStartTime = 0;
    lastPacketTime = 0;
    maxGap = 0;
    droppedPackets = 0;
    writeQueue = [];
    Object.keys(packetStats).forEach(key => delete packetStats[key]);
    
    // Create temp file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5);
    currentTempFile = path.join(tempDir, `temp_session_${timestamp}.bin`);
    
    writeStream = fs.createWriteStream(currentTempFile, {
        highWaterMark: 1024 * 1024
    });
    
    currentState = RecordState.RECORDING;
    updateDisplay();
    
    console.log(chalk.green.bold('\n\n🎬 RECORDING STARTED!'));
    console.log(chalk.gray('Waiting for F1 25 telemetry data...'));
}

function finishRecording() {
    if (currentState !== RecordState.RECORDING && currentState !== RecordState.PAUSED) {
        console.log(chalk.yellow('\n⚠️  Not recording! Press [R] to start a new recording.\n'));
        setTimeout(updateDisplay, 2000);
        return;
    }
    
    currentState = RecordState.FINISHED;
    
    // Flush remaining queue
    if (writeQueue.length > 0) {
        const buffers = [];
        writeQueue.forEach(({ metadata, data }) => {
            buffers.push(metadata, data);
        });
        const combined = Buffer.concat(buffers);
        writeStream.write(combined);
    }
    
    writeStream.end();
    updateDisplay();
    
    console.log(chalk.green.bold('\n\n🏁 RECORDING FINISHED!'));
    console.log(chalk.cyan('Press [S] to save or [D] to discard'));
}

function saveRecording() {
    if (currentState !== RecordState.FINISHED || !currentTempFile) {
        console.log(chalk.yellow('\n⚠️  No finished recording to save! Press [F] first.\n'));
        setTimeout(updateDisplay, 2000);
        return;
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5);
    const finalFile = path.join(dataDir, `f1_session_${timestamp}.bin`);
    
    // Move temp file to final location
    fs.renameSync(currentTempFile, finalFile);
    
    currentState = RecordState.IDLE;
    currentTempFile = null;
    writeStream = null;
    
    updateDisplay();
    console.log(chalk.green.bold(`\n\n💾 RECORDING SAVED!`));
    console.log(chalk.cyan(`File: ${path.basename(finalFile)}`));
}

function discardRecording() {
    if (!currentTempFile) {
        console.log(chalk.yellow('\n⚠️  No recording to discard!\n'));
        setTimeout(updateDisplay, 2000);
        return;
    }
    
    if (writeStream) {
        writeStream.end();
    }
    
    // Delete temp file if it exists
    if (fs.existsSync(currentTempFile)) {
        fs.unlinkSync(currentTempFile);
    }
    
    currentState = RecordState.IDLE;
    currentTempFile = null;
    writeStream = null;
    
    updateDisplay();
    console.log(chalk.red.bold('\n\n🗑️  RECORDING DISCARDED!'));
    console.log(chalk.gray('Press [R] to start a new recording'));
}

function togglePause() {
    if (currentState === RecordState.RECORDING) {
        currentState = RecordState.PAUSED;
        updateDisplay();
        console.log(chalk.yellow.bold('\n\n⏸️  RECORDING PAUSED'));
        console.log(chalk.gray('Press [P] to resume'));
    } else if (currentState === RecordState.PAUSED) {
        currentState = RecordState.RECORDING;
        updateDisplay();
        console.log(chalk.green.bold('\n\n▶️  RECORDING RESUMED'));
    } else {
        console.log(chalk.yellow('\n⚠️  Start a recording first with [R]!\n'));
        setTimeout(updateDisplay, 2000);
    }
}

// Handle keyboard input
process.stdin.on('keypress', (str, key) => {
    if (!key) return;
    
    if (key.ctrl && key.name === 'c') {
        cleanup();
        return;
    }
    
    switch(key.name) {
        case 'r':
            startNewRecording();
            break;
        case 'f':
            finishRecording();
            break;
        case 's':
            saveRecording();
            break;
        case 'd':
            discardRecording();
            break;
        case 'p':
            togglePause();
            break;
        case 'h':
            updateDisplay();
            break;
        case 'q':
            cleanup();
            break;
    }
});

// Handle UDP messages
server.on('message', (msg, rinfo) => {
    // Only process if recording
    if (currentState !== RecordState.RECORDING) {
        return;
    }
    
    packetCount++;
    const now = Date.now();
    
    if (sessionStartTime === 0) {
        sessionStartTime = now;
        updateDisplay();
        console.log(chalk.green.bold('\n\n📡 RECEIVING DATA FROM F1 25!'));
    }
    
    // Monitor packet timing
    if (lastPacketTime > 0) {
        const gap = now - lastPacketTime;
        maxGap = Math.max(maxGap, gap);
        
        if (gap > 100) {
            const missedPackets = Math.floor(gap / 50) - 1;
            if (missedPackets > 0) {
                droppedPackets += missedPackets;
            }
        }
    }
    lastPacketTime = now;
    
    // Read packet header
    const packetFormat = msg.readUInt16LE(0);
    const packetId = msg.readUInt8(6);
    const packetType = packetTypes[packetId] || 'Unknown';
    
    // Update packet statistics
    packetStats[packetType] = (packetStats[packetType] || 0) + 1;
    
    // Queue packet for writing with metadata
    const metadataBuffer = Buffer.alloc(12);
    metadataBuffer.writeUInt32LE(msg.length, 0);
    metadataBuffer.writeBigUInt64LE(BigInt(now), 4);
    
    writeQueue.push({
        metadata: metadataBuffer,
        data: Buffer.from(msg)
    });
    
    dataSize += metadataBuffer.length + msg.length;
    
    // Process write queue
    processWriteQueue();
});

// Update display periodically when recording
setInterval(() => {
    if (currentState === RecordState.RECORDING) {
        animationIndex = (animationIndex + 1) % recordingFrames.length;
        updateDisplay();
    }
}, 500);

server.on('error', (err) => {
    console.log(chalk.red.bold(`\n❌ ERROR: ${err.message}`));
    if (err.code === 'EADDRINUSE') {
        console.log(chalk.yellow('Port 20777 is already in use!'));
        console.log(chalk.gray('Close other telemetry tools first.'));
    }
    server.close();
});

server.on('listening', () => {
    const address = server.address();
    
    // Try to set buffer size after socket is bound
    try {
        server.setRecvBufferSize(1024 * 1024 * 4);
        console.log(chalk.green('⚡ UDP buffer optimized for high-speed capture\n'));
    } catch (err) {
        // Silent fail, not critical
    }
});

function cleanup() {
    console.log(chalk.yellow.bold('\n\n🏁 SHUTTING DOWN...'));
    
    if (currentState === RecordState.RECORDING || currentState === RecordState.PAUSED) {
        console.log(chalk.yellow('⚠️  Recording in progress! Auto-saving...'));
        finishRecording();
        saveRecording();
    } else if (currentState === RecordState.FINISHED) {
        console.log(chalk.yellow('⚠️  Unsaved recording! Auto-saving...'));
        saveRecording();
    }
    
    if (writeStream) {
        writeStream.end();
    }
    
    server.close();
    console.log(chalk.green.bold('✅ Goodbye!'));
    process.exit(0);
}

// Handle process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Bind server
server.bind(20777, '0.0.0.0');