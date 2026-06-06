import csv
import random
from datetime import datetime, timedelta

def generate_feuille1(num_rows):
    locations = ["Administration", "Comptabilité", "Laboratoire IA", "Bibliothèque", "Magasin Informatique", "Direction", "RH", "Finance", "Secrétariat", "Salle de Conférence"]
    manufacturers = ["Dell", "HP", "Lenovo", "Apple", "Samsung", "LG", "Canon", "Epson", "Brother", "Cisco"]
    item_types = ["Computer", "Laptop", "Monitor", "Printer", "Scanner", "Switch", "Router", "UPS"]
    statuses = ["En production", "Maintenance", "En stock", "En panne", "Mis au rebut", "En prOduction"] # small typo
    
    with open('import/test-feuille1-200.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["Name", "Status", "Location", "Manufacturer", "Item_Type", "Model", "Inventory_Number", "User"])
        for i in range(1, num_rows + 1):
            itype = random.choice(item_types)
            name = f"{itype[:2].upper()}-{random.choice(['ADM','FIN','HR','IT'])}-{i:03d}"
            status = random.choice(statuses)
            # inject a typo rarely
            if random.random() < 0.05:
                status = "En prduction"
            
            location = random.choice(locations)
            manuf = random.choice(manufacturers)
            model = f"Model {random.randint(100, 999)}"
            inv = f"ITU-2026-{i:04d}"
            user = f"User {i}" if random.random() > 0.2 else ""
            
            # inject empty mandatory field sometimes
            if random.random() < 0.02:
                name = ""
            
            writer.writerow([name, status, location, manuf, itype, model, inv, user])

def generate_feuille2(num_rows):
    types = ["Incident", "Request"]
    priorities = ["Very high", "High", "Medium", "Low", "Very low"]
    statuses = ["New", "Processing (assigned)", "Processing (planned)", "Pending", "Solved", "Closed"]
    
    with open('import/test-feuille2-200.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["Ref_Ticket", "Date", "Heure", "Type", "Titre", "Description", "Status", "Priority", "Items"])
        
        start_date = datetime(2026, 6, 1)
        for i in range(1, num_rows + 1):
            date_obj = start_date + timedelta(days=random.randint(0, 30))
            # Some small date format errors
            if random.random() < 0.05:
                date_str = date_obj.strftime("%Y-%m-%d") # ISO instead of DD/MM/YYYY
            else:
                date_str = date_obj.strftime("%d/%m/%Y")
            
            heure = f"{random.randint(8,17):02d}:{random.choice(['00','15','30','45'])}"
            ttype = random.choice(types)
            titre = f"Problème {i}"
            desc = f"Description détaillée pour le ticket {i}"
            
            if random.random() < 0.05:
                titre = "" # Missing title
            
            status = random.choice(statuses)
            prio = random.choice(priorities)
            # Create JSON array of items
            items = '["PC-ADM-001"]' if random.random() > 0.5 else '["MN-DIR-001", "PR-RH-001"]'
            
            writer.writerow([i, date_str, heure, ttype, titre, desc, status, prio, items])

def generate_feuille3(num_rows):
    with open('import/test-feuille3-200.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["Num_Ticket", "Duration_second", "Time_Cost", "Fixed_Cost"])
        for i in range(1, num_rows + 1):
            duration = random.choice([0, 300, 600, 900, 1800, 3600, 7200])
            # typo in duration occasionally
            if random.random() < 0.02:
                duration = -300
            
            time_cost = f"{duration * 0.0145:.2f}".replace('.', ',')
            if duration == 0: time_cost = "0"
            fixed_cost = random.choice(["0", "50", "100", "150", "200", ""])
            
            writer.writerow([i, duration, time_cost, fixed_cost])

generate_feuille1(200)
generate_feuille2(200)
generate_feuille3(200)
print("Fichiers generes avec succes.")
