// F1 25 Data Replay Tool - Test Environment
const dgram = require('dgram');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🎮 F1 25 Data Replay Tool');
console.log('========================\n');

// List available data files
const dataDir = path.join(__dirname, 'captured_data');

if (!fs.existsSync(dataDir)) {
    console.log('❌ No captured data directory found!');
    console.log('   Run f1-packages.js first to capture some data.');
    process.exit(1);
}

const files = fs.readdirSync(dataDir)
    .filter(f => f.endsWith('.bin'))
    .sort()
    .reverse();

if (files.length === 0) {
    console.log('❌ No data files found!');
    console.log('   Run f1-packages.js first to capture some data.');
    process.exit(1);
}

console.log('📁 Available sessions:');
files.forEach((file, index) => {
    const stats = fs.statSync(path.join(dataDir, file));
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    const date = file.match(/f1_session_(.+)\.bin/)[1].replace(/_/g, ' ').replace(/-/g, ':');
    console.log(`   ${index + 1}. ${date} (${sizeMB} MB)`);
});

rl.question('\nSelect session number (or press Enter for latest): ', (answer) => {
    const selection = answer ? parseInt(answer) - 1 : 0;
    const selectedFile = files[selection];
    
    if (!selectedFile) {
        console.log('❌ Invalid selection!');
        rl.close();
        process.exit(1);
    }
    
    const filepath = path.join(dataDir, selectedFile);
    console.log(`\n📂 Loading: ${selectedFile}`);
    
    rl.question('Enter target port (default 20777): ', (portAnswer) => {
        const targetPort = portAnswer ? parseInt(portAnswer) : 20777;
        
        rl.question('Enter replay speed (1-10, default 1): ', (speedAnswer) => {
            const speed = speedAnswer ? Math.min(10, Math.max(1, parseInt(speedAnswer))) : 1;
            
            startReplay(filepath, targetPort, speed);
            rl.close();
        });
    });
});

function startReplay(filepath, targetPort, speed) {
    const client = dgram.createSocket('udp4');
    const fileBuffer = fs.readFileSync(filepath);
    
    let offset = 0;
    let packetCount = 0;
    let firstTimestamp = null;
    let replayStartTime = Date.now();
    
    console.log(`\n▶️  Starting replay on port ${targetPort} at ${speed}x speed...`);
    console.log('   Press Ctrl+C to stop\n');
    
    function sendNextPacket() {
        if (offset >= fileBuffer.length) {
            console.log('\n✅ Replay complete!');
            console.log(`   Sent ${packetCount} packets`);
            client.close();
            process.exit(0);
            return;
        }
        
        // Read metadata
        const packetSize = fileBuffer.readUInt32LE(offset);
        const timestamp = Number(fileBuffer.readBigUInt64LE(offset + 4));
        offset += 12;
        
        // Read packet data
        const packetData = fileBuffer.slice(offset, offset + packetSize);
        offset += packetSize;
        
        // Send packet
        client.send(packetData, targetPort, '127.0.0.1', (err) => {
            if (err) {
                console.error('❌ Send error:', err);
                client.close();
                process.exit(1);
            }
        });
        
        packetCount++;
        
        // Update status
        if (packetCount % 100 === 0) {
            process.stdout.write(`\r📡 Replaying: ${packetCount} packets sent`);
        }
        
        // Calculate next packet delay
        if (firstTimestamp === null) {
            firstTimestamp = timestamp;
            setImmediate(sendNextPacket);
        } else {
            const originalDelay = timestamp - firstTimestamp;
            const replayDelay = originalDelay / speed;
            const targetTime = replayStartTime + replayDelay;
            const waitTime = targetTime - Date.now();
            
            if (waitTime > 0) {
                setTimeout(sendNextPacket, waitTime);
            } else {
                setImmediate(sendNextPacket);
            }
        }
    }
    
    sendNextPacket();
}

process.on('SIGINT', () => {
    console.log('\n\n⏹️  Replay stopped by user');
    process.exit(0);
});