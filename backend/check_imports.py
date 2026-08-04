import os
import re

BASE_DIR = r"C:\Projects\compliance_app\backend"

risk_class_pattern = re.compile(r"class\s+Risk\s*\(")
risk_import_pattern = re.compile(r"import\s+.*Risk")

print("\n=== MODEL DOSYALARI TARAMA ===\n")

risk_file_found = None
risk_class_found = False

models_dir = os.path.join(BASE_DIR, "app", "models")

for root, _, files in os.walk(models_dir):
    for f in files:
        # PYTHON BYTECODE DOSYALARINI ATLAMAK
        if f.endswith(".pyc") or "__pycache__" in root:
            continue

        if "risk" in f.lower():
            full = os.path.join(root, f)
            print(f"[+] Risk dosyası bulundu: {full}")
            risk_file_found = full

            try:
                with open(full, "r", encoding="utf-8") as rf:
                    content = rf.read()
                    if risk_class_pattern.search(content):
                        print("    ✔ Risk sınıfı tanımlı")
                        risk_class_found = True
                    else:
                        print("    ✘ Risk sınıfı TANIMLI DEĞİL")
            except Exception as e:
                print(f"    ⚠ Dosya okunamadı: {e}")

print("\n=== __init__.py IMPORT TARAMA ===\n")

init_path = os.path.join(models_dir, "__init__.py")
with open(init_path, "r", encoding="utf-8") as f:
    for line in f:
        if "risk" in line.lower():
            print(f"[IMPORT] {line.strip()}")

print("\n=== main.py IMPORT TARAMA ===\n")

main_path = os.path.join(BASE_DIR, "main.py")
with open(main_path, "r", encoding="utf-8") as f:
    for line in f:
        if "risk" in line.lower() or "models" in line.lower():
            print(f"[MAIN] {line.strip()}")

print("\n=== ÖZET ===\n")

if not risk_file_found:
    print("❌ risks.py bulunamadı")
elif not risk_class_found:
    print("❌ risks.py VAR ama içinde class Risk YOK")
else:
    print("✔ Risk sınıfı mevcut.")

print("\nTarama tamamlandı.\n")
