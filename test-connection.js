// test-connection.js - Quick F1 25 Connection Test
const dgram = require('dgram');
const server = dgram.createSocket('udp4');

console.log('🏁 F1 25 Connection Test');
console.log('========================');
console.log('Listening on port 20777...\n');

let packetCount = 0;
let lastPacketTime = Date.now();

server.on('message', (msg, rinfo) => {
    packetCount++;
    const now = Date.now();
    
    // Read packet header
    const packetFormat = msg.readUInt16LE(0);
    const packetId = msg.readUInt8(6);
    
    // Packet type names
    const packetTypes = [
        'Motion', 'Session', 'Lap Data', 'Event', 'Participants',
        'Car Setups', 'Car Telemetry', 'Car Status', 'Final Classification',
        'Lobby Info', 'Car Damage', 'Session History', 'Tyre Sets',
        'Motion Ex', 'Time Trial'
    ];
    
    console.log(`✅ Packet #${packetCount} received!`);
    console.log(`   Format: ${packetFormat} (${packetFormat === 2025 ? 'F1 25' : packetFormat === 2024 ? 'F1 24' : 'Unknown'})`);
    console.log(`   Type: ${packetTypes[packetId] || 'Unknown'} (ID: ${packetId})`);
    console.log(`   Size: ${msg.length} bytes`);
    console.log(`   From: ${rinfo.address}:${rinfo.port}`);
    console.log(`   Time since last: ${now - lastPacketTime}ms`);
    console.log('');
    
    lastPacketTime = now;
    
    if (packetCount === 1) {
        console.log('🎉 SUCCESS! Connection established with F1 25!');
        console.log('📊 Telemetry data is flowing correctly.');
        console.log('');
    }
    
    if (packetFormat !== 2025) {
        console.log(`⚠️  Warning: Expected format 2025 for F1 25, got ${packetFormat}`);
        console.log('   Check your game telemetry settings.');
        console.log('');
    }
});

server.on('error', (err) => {
    console.log(`❌ Error: ${err.message}`);
    if (err.code === 'EADDRINUSE') {
        console.log('   Port 20777 is already in use!');
        console.log('   Close other telemetry applications first.');
    }
    server.close();
});

server.on('listening', () => {
    const address = server.address();
    console.log(`📡 Server listening on ${address.address}:${address.port}`);
    console.log('');
    console.log('📋 Checklist:');
    console.log('   1. Start F1 25');
    console.log('   2. Go to Settings → Telemetry Settings');
    console.log('   3. Set UDP Telemetry to ON');
    console.log('   4. Set UDP IP to 127.0.0.1 (same PC) or this PC\'s IP');
    console.log('   5. Set UDP Port to 20777');
    console.log('   6. Set UDP Format to 2025');
    console.log('   7. Start any session and go on track');
    console.log('');
    console.log('⏳ Waiting for F1 25 data...');
    console.log('   (Press Ctrl+C to stop)');
    console.log('');
});

// Timeout warning
setTimeout(() => {
    if (packetCount === 0) {
        console.log('⚠️  No data received after 30 seconds!');
        console.log('');
        console.log('Troubleshooting:');
        console.log('   • Is F1 25 running and in a session?');
        console.log('   • Is UDP Telemetry enabled in game settings?');
        console.log('   • Is the IP address correct? (127.0.0.1 for same PC)');
        console.log('   • Is the port set to 20777 in game?');
        console.log('   • Check Windows Firewall / antivirus settings');
        console.log('   • For consoles: Are both devices on same WiFi network?');
        console.log('');
    }
}, 30000);

// Stats every 10 seconds
setInterval(() => {
    if (packetCount > 0) {
        console.log(`📈 Stats: ${packetCount} packets received (${(packetCount / 10).toFixed(1)} packets/sec)`);
        console.log('');
        packetCount = 0;
    }
}, 10000);

server.bind(20777, '0.0.0.0');