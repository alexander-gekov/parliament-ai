import requests
import json
from datetime import datetime, timedelta

base_url = "https://data.strazha.bg/sessions/"

# Generate dates for September 2024
start_date = datetime(2024, 9, 1)
end_date = datetime(2024, 9, 30)
date_range = [start_date + timedelta(days=x) for x in range((end_date - start_date).days + 1)]

for date in date_range:
    date_str = date.strftime("%Y-%m-%d")
    index_url = f"{base_url}{date_str}/index.json"
    
    try:
        response = requests.get(index_url)
        response.raise_for_status()
        index_data = response.json()
        
        statement_count = index_data.get("statementCount", 0)
        batch_count = (statement_count + 4) // 5  # Ceiling division by 5

        all_session_statements = []  # List to store all statements for this date
        
        for batch in range(batch_count):
            steno_url = f"{base_url}{date_str}/steno/{batch}.json"
            
            try:
                steno_response = requests.get(steno_url)
                steno_response.raise_for_status()
                steno_data = steno_response.json()
                
                session_statements = steno_data.get("sessionStatements", [])
                all_session_statements.extend(session_statements)
                
            except requests.RequestException as e:
                print(f"Error fetching steno data for {date_str}, batch {batch}: {e}")
        
        # Save all statements for this date outside the batch loop
        output_filename = f"data_sep/{date_str}.json"
        with open(output_filename, 'w') as output_file:
            json.dump({"sessionStatements": all_session_statements}, output_file, ensure_ascii=False, indent=4)
        print(f"Saved all session statements for {date_str} to {output_filename}")
        
    except requests.RequestException as e:
        print(f"Error fetching index data for {date_str}: {e}")
