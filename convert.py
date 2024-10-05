import json
import os

# # Sample JSON structure
# data = json.load(open('data_sep/04-09.json'))


# Function to convert the JSON data into free-flow text
def json_to_free_flow_text(json_data):
    # Check if json_data is a list and take the first item if so
    if isinstance(json_data, list):
        json_data = json_data[0] if json_data else {}

    parl_session = json_data.get('parlSession', {})
    title = parl_session.get('title', 'No Title')
    date = parl_session.get('date', 'No Date')
    statement_count = json_data.get('statementCount', 0)
    person_count = json_data.get('personCount', 0)
    
    session_statements = json_data.get('sessionStatements', [])
    free_flow_text = f"Session Title: {title}\nDate: {date}\nTotal Statements: {statement_count}\nTotal Participants: {person_count}\n\n"
    
    for statement in session_statements:
        position = statement.get('position', 'Unknown Position')
        person_name = statement.get('title', 'Unknown Person')
        paragraphs = " ".join(statement.get('paragraphs', []))
        free_flow_text += f"{position} (ID: {person_name}):\n{paragraphs}\n\n"
    
    return free_flow_text

def process_json_files(folder_path):
    for filename in os.listdir(folder_path):
        if filename.endswith('.json'):
            file_path = os.path.join(folder_path, filename)
            with open(file_path, 'r') as file:
                data = json.load(file)
            
            free_flow_text = json_to_free_flow_text(data)
            
            # Create output filename
            output_filename = f"{os.path.splitext(filename)[0]}.txt"
            output_path = os.path.join('output', output_filename)
            
            # Write the free-flow text to a file
            with open(output_path, 'w') as output_file:
                output_file.write(free_flow_text)
            
            print(f"Processed: {filename} -> {output_filename}")

# Create output directory if it doesn't exist
os.makedirs('output', exist_ok=True)

# Process JSON files in data_aug folder
process_json_files('data_aug')

# Process JSON files in data_sep folder
process_json_files('data_sep')

print("All files processed successfully.")
