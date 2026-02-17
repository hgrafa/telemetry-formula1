# F1 25 Telemetry Logger - Complete Setup Guide

## Prerequisites
- F1 25 game (PC, PlayStation, or Xbox)
- Computer with Node.js installed
- Both devices on the same network

## Step 1: Install Node.js

### Windows:
1. Go to [nodejs.org](https://nodejs.org)
2. Download the LTS version
3. Run the installer and follow the prompts
4. Open Command Prompt and verify: `node --version`

### Mac:
```bash
# Using Homebrew
brew install node

# Or download from nodejs.org
```

### Linux:
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nodejs npm

# Fedora
sudo dnf install nodejs npm
```

## Step 2: Create the Project

1. **Create a new folder** for your telemetry project:
```bash
mkdir f1-telemetry
cd f1-telemetry
```

2. **Initialize the Node.js project**:
```bash
npm init -y
```

3. **Install required package** (chalk for colored output):
```bash
npm install chalk@4.1.2
```

## Step 3: Create the Telemetry Application

1. **Create a new file** called `f1-telemetry-logger.js`
2. **Copy the entire code** from the artifact above into this file
3. **Save the file**

## Step 4: Configure F1 25 Game Settings

### In-Game Configuration:

1. **Start F1 25** and go to the main menu
2. Navigate to: **Settings → Telemetry Settings**
3. Configure these settings:
   - **UDP Telemetry**: ON
   - **UDP Broadcast Mode**: ON (if multiple apps) or OFF (single app)
   - **UDP IP Address**: 
     - Same PC: `127.0.0.1`
     - Different PC: Your computer's IP address (see below)
   - **UDP Port**: `20777`
   - **UDP Send Rate**: `20 Hz` (recommended)
   - **UDP Format**: `2025`
   - **Your Telemetry**: `Public` (to see all data)

### Finding Your Computer's IP Address:

**Windows:**
```bash
ipconfig
# Look for IPv4 Address (e.g., 192.168.1.100)
```

**Mac/Linux:**
```bash
ifconfig
# Or
ip addr show
# Look for inet address (e.g., 192.168.1.100)
```

## Step 5: Network Configuration

### PC Setup:
- **Windows Firewall**: Allow Node.js through firewall when prompted
- **Antivirus**: May need to add exception for Node.js

### Console Setup (PlayStation/Xbox):
1. **Connect console to WiFi** (same network as your computer)
2. **Disable router isolation** if enabled
3. **Note console's IP** from network settings

### Router Configuration (if needed):
- No port forwarding needed for local network
- Ensure devices can communicate (no guest network isolation)

## Step 6: Run the Telemetry Logger

1. **Open terminal/command prompt** in your project folder
2. **Start the application**:
```bash
node f1-telemetry-logger.js
```

3. You should see:
```
╔════════════════════════════════════════╗
║     F1 25 TELEMETRY LOGGER v1.0        ║
║     Real-time All Drivers Monitor      ║
╚════════════════════════════════════════╝
🏁 F1 25 Telemetry Logger Started
📡 Listening for UDP packets on 0.0.0.0:20777
⚠️  Make sure F1 25 telemetry is enabled and set to port 20777
```

## Step 7: Start Racing

1. **Start any session** in F1 25 (Practice, Qualifying, Race, Time Trial)
2. **Data will appear automatically** once you're on track
3. The display shows:
   - Position, driver names, lap numbers
   - Last lap times, current speed
   - Gear, fuel levels, tyre info
   - DRS status and driver status
   - **Your car is highlighted in yellow**

## Understanding the Display

```
═══════════════════════════════════════════════════════════════════
  F1 25 TELEMETRY - Race - Track Temp: 28°C
═══════════════════════════════════════════════════════════════════

Pos │ Driver          │ Lap  │ Last Lap    │ Speed │ Gear │ Fuel │ Tyre    │ DRS │ Status
────┼─────────────────┼──────┼─────────────┼───────┼──────┼──────┼─────────┼─────┼────────
  1 │ M. VERSTAPPEN   │   5  │ 1:21.456    │ 287 km/h │   7  │ 45.2kg │ C3  12L │ OFF │ Flying Lap
  2 │ L. HAMILTON     │   5  │ 1:21.789    │ 285 km/h │   7  │ 44.8kg │ C3  12L │ ON  │ Flying Lap
  3 │ YOU (Player)    │   5  │ 1:22.123    │ 283 km/h │   7  │ 45.0kg │ C3  12L │ OFF │ Flying Lap
```

## Troubleshooting

### No Data Appearing:

1. **Check game settings** - Ensure telemetry is ON and port is 20777
2. **Check IP address** - Use correct IP in game settings
3. **Firewall** - Allow Node.js through firewall
4. **Network** - Ensure devices on same network
5. **Game state** - Must be in a session and on track

### Wrong Format Error:
- Ensure UDP Format is set to `2025` in game
- For F1 24, change to `2024`

### Connection Refused:
- Port might be in use: `netstat -an | grep 20777`
- Try different port (change in both game and code)

### Console Specific Issues:

**PlayStation:**
- Must be on WiFi (not LAN cable for telemetry)
- Check NAT type (should be Type 1 or 2)

**Xbox:**
- Enable network discovery in Windows if on same network
- Check Xbox network settings for IP address

## Advanced Features to Add

### 1. Data Logging to File:
```javascript
const fs = require('fs');
const logStream = fs.createWriteStream('telemetry.log', { flags: 'a' });

// In your packet handlers:
logStream.write(JSON.stringify({
    timestamp: Date.now(),
    data: driver.telemetry
}) + '\n');
```

### 2. Web Dashboard:
```javascript
// Add Express server
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Emit data to web clients
io.emit('telemetry', drivers);
```

### 3. Lap Time Comparison:
```javascript
const lapHistory = new Map();

// Store lap times for comparison
if (driver.lapData.lastLapTime) {
    if (!lapHistory.has(driver.name)) {
        lapHistory.set(driver.name, []);
    }
    lapHistory.get(driver.name).push(driver.lapData.lastLapTime);
}
```

### 4. CSV Export:
```javascript
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const csvWriter = createCsvWriter({
    path: 'telemetry.csv',
    header: [
        {id: 'time', title: 'TIME'},
        {id: 'driver', title: 'DRIVER'},
        {id: 'speed', title: 'SPEED'},
        {id: 'gear', title: 'GEAR'},
        {id: 'throttle', title: 'THROTTLE'},
        {id: 'brake', title: 'BRAKE'}
    ]
});
```

## Performance Tips

1. **Optimal Send Rate**: 20Hz provides good balance
2. **Buffer Size**: Code uses 2048 bytes (sufficient for all packets)
3. **Display Update**: Set to 100ms (10 FPS) for smooth updates
4. **Memory**: Application uses ~50MB RAM
5. **CPU**: Minimal usage (<5% on modern systems)

## Next Steps

1. **Customize the display** - Add/remove fields as needed
2. **Create a web interface** - Use the data for a browser dashboard
3. **Add data analysis** - Calculate average speeds, lap deltas
4. **Store session data** - Save to database for later analysis
5. **Multi-session comparison** - Compare performance across sessions

## Common Packet Types Reference

- **Motion (0)**: Car positions, velocities, G-forces
- **Session (1)**: Track, weather, session info
- **Lap Data (2)**: Lap times, positions, penalties
- **Events (3)**: DRS, penalties, fastest lap notifications
- **Participants (4)**: Driver names, teams
- **Car Telemetry (6)**: Speed, throttle, brake, temperatures
- **Car Status (7)**: Fuel, tyres, ERS, damage

## Support

- **Official EA F1 Forums**: For game-specific issues
- **Node.js Documentation**: nodejs.org/docs
- **UDP Protocol Info**: For network troubleshooting

## Safety Note

- Never expose port 20777 to the internet
- UDP has no encryption - use only on trusted networks
- Consider VPN for remote telemetry needs