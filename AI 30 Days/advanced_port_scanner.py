import socket
import threading
import queue
import json
import os
from datetime import datetime

print("\n=== ADVANCED AI-POWERED PORT SCANNER (WITH FOLDER SYSTEM) ===\n")

COMMON_PORTS = {
    21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS",
    80: "HTTP", 110: "POP3", 135: "RPC", 139: "NetBIOS",
    143: "IMAP", 443: "HTTPS", 445: "SMB", 3306: "MySQL",
    3389: "RDP", 5900: "VNC", 8080: "HTTP-Proxy"
}

open_ports = []
result_details = []
q = queue.Queue()
lock = threading.Lock()

def setup_folders():
    os.makedirs("reports/txt", exist_ok=True)
    os.makedirs("reports/json", exist_ok=True)

setup_folders()


def banner_grab(ip, port):
    try:
        s = socket.socket()
        s.settimeout(0.7)
        s.connect((ip, port))
        banner = s.recv(1024).decode(errors="ignore").strip()
        return banner if banner else "Unknown Service"
    except:
        return "Unknown Service"


def scan(ip):
    while not q.empty():
        port = q.get()
        try:
            s = socket.socket()
            s.settimeout(0.5)
            result = s.connect_ex((ip, port))
            if result == 0:
                with lock:
                    service = COMMON_PORTS.get(port, "Unknown")
                    banner = banner_grab(ip, port)
                    print(f"[OPEN] Port {port} | {service} | Banner: {banner}")
                    open_ports.append(port)
                    result_details.append({
                        "port": port,
                        "service": service,
                        "banner": banner
                    })
            s.close()
        except:
            pass
        q.task_done()


def generate_reports(ip):
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")

    # ----------------------------
    # TXT REPORT (FORCE UTF-8)
    # ----------------------------
    txt_filename = f"reports/txt/AI_Port_Scan_{ip}_{timestamp}.txt"
    with open(txt_filename, "w", encoding="utf-8") as f:
        f.write("=== ADVANCED AI SECURITY PORT SCAN REPORT ===\n\n")
        f.write(f"Target: {ip}\n")
        f.write(f"Scan Time: {datetime.now()}\n\n")

        if open_ports:
            f.write("Open Ports:\n")
            for item in result_details:
                f.write(f"- Port {item['port']} | {item['service']} | Banner: {item['banner']}\n")
        else:
            f.write("No open ports detected.\n")

        f.write("\n=== AI RISK SUMMARY ===\n")
        if open_ports:
            f.write("⚠ Exposed network services found. These may allow brute-force or exploit attempts.\n")
            f.write("\nRecommendations:\n")
            f.write("- Close unused ports\n")
            f.write("- Apply firewall rules\n")
            f.write("- Enable IDS/IPS (Suricata / Wazuh)\n")
            f.write("- Perform deeper vulnerability testing\n")
        else:
            f.write("✔ No common vulnerabilities found.\n")

    # ----------------------------
    # JSON REPORT
    # ----------------------------
    json_filename = f"reports/json/AI_Port_Scan_{ip}_{timestamp}.json"
    with open(json_filename, "w", encoding="utf-8") as jf:
        json.dump({
            "target": ip,
            "timestamp": str(datetime.now()),
            "open_ports": result_details
        }, jf, indent=4)

    print(f"\n[✓] Text Report Saved → {txt_filename}")
    print(f"[✓] JSON Report Saved → {json_filename}\n")


def main():
    ip = input("Enter target IP/domain: ")
    mode = input("Scan Mode (1 = Common Ports, 2 = Full Scan): ")

    print("\nInitializing scan...\n")

    if mode == "1":
        ports = COMMON_PORTS.keys()
    else:
        ports = range(1, 65535)

    for port in ports:
        q.put(port)

    threads = []
    for _ in range(100):
        t = threading.Thread(target=scan, args=(ip,))
        t.daemon = True
        threads.append(t)

    for t in threads:
        t.start()

    q.join()

    print("\nScan Complete!")
    generate_reports(ip)


if __name__ == "__main__":
    main()
