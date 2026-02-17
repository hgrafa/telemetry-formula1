import os from "os";
import fs from "fs";

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
}

const ip = getLocalIp();
fs.writeFileSync(".env.local", `VITE_LOCAL_IP=${ip}\n`);
console.log(`.env.local atualizado com VITE_LOCAL_IP=${ip}`);
