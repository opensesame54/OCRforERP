import os
import json
import logging
import fitz  # PyMuPDF
from paddleocr import PaddleOCR
import ollama

# Suppress PaddleOCR's verbose debug logs so your terminal stays clean
logging.getLogger("ppocr").setLevel(logging.WARNING)

class InvoicePipeline:
    def __init__(self):
        print("Initializing stable OCR engine (PaddleOCR 2.8.1 / PaddlePaddle 2.6.2)...")
        # Using the stable 2.8.1 syntax. show_log and use_angle_cls work perfectly here.
        self.ocr_engine = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)

    def extract_text_from_native_pdf(self, file_path):
        """The Fast Path: Extracts embedded text directly using PyMuPDF."""
        print("Executing Fast Path (PyMuPDF)...")
        text = ""
        with fitz.open(file_path) as pdf:
            for page in pdf:
                text += page.get_text()
        return text

    def extract_text_with_vision(self, file_path):
        """The Heavy Path: Uses PaddleOCR to read pixels from scans or images."""
        print("Executing Heavy Path (PaddleOCR)...")
        # In stable version 2.8.1, we use .ocr() and pass cls=True directly
        result = self.ocr_engine.ocr(file_path, cls=True)
        
        extracted_text = []
        
        # PaddleOCR 2.8.1 returns a specific nested list structure
        if result is not None:
            for idx in range(len(result)):
                res = result[idx]
                if res is not None:
                    for line in res:
                        # Extract just the text string, ignoring bounding box coordinates
                        extracted_text.append(line[1][0])
                        
        return "\n".join(extracted_text)

    def parse_to_json(self, raw_text):
        """Passes the raw text to a local LLM to structure it into JSON."""
        print("Parsing extracted text with local LLM (Ollama)...")
        
        # Define the exact schema required for Odoo injection
        prompt = f"""
        You are a strict data extraction AI. Extract the invoice details from the raw text below.
        You must reply ONLY with a valid JSON object matching this schema, nothing else:
        {{
            "vendor_name": "String",
            "invoice_date": "YYYY-MM-DD",
            "invoice_number": "String",
            "tax_id": "String or null",
            "total_amount": Float,
            "line_items": [
                {{"description": "String", "quantity": Float, "unit_price": Float, "total": Float}}
            ]
        }}
        
        Raw OCR Text:
        ---
        {raw_text}
        ---
        """
        
        # Call the local LLM via Ollama
        response = ollama.chat(model='llama3', messages=[
            {
                'role': 'user',
                'content': prompt,
            }
        ])
        
        # Clean the response (LLMs sometimes wrap JSON in markdown blocks)
        raw_json = response['message']['content']
        clean_json = raw_json.replace('```json', '').replace('```', '').strip()
        
        try:
            return json.loads(clean_json)
        except json.JSONDecodeError:
            print("Failed to parse LLM output into JSON. Raw output:")
            return raw_json

    def process_document(self, file_path):
        """The Router: Decides which extraction path to take."""
        print(f"\nProcessing: {file_path}")
        file_ext = os.path.splitext(file_path)[1].lower()
        raw_text = ""

        # 1. If it's an image, it MUST go to the heavy path
        if file_ext in ['.jpg', '.jpeg', '.png', '.tiff']:
            raw_text = self.extract_text_with_vision(file_path)

        # 2. If it's a PDF, test for embedded text
        elif file_ext == '.pdf':
            # Try the fast path first
            raw_text = self.extract_text_from_native_pdf(file_path)
            
            # If the PDF is just a scanned image, the text length will be zero or very low.
            # We set a threshold of 50 characters to determine if we need vision OCR.
            if len(raw_text.strip()) < 50:
                print("PDF appears to be a flat scan. Rerouting to vision engine...")
                raw_text = self.extract_text_with_vision(file_path)
            else:
                print("Native PDF detected. Skipping vision engine.")
        
        else:
            raise ValueError(f"Unsupported file format: {file_ext}")

        # 3. Pass the extracted text to the LLM to get the final JSON
        if not raw_text.strip():
            print("Warning: No text could be extracted from the document.")
            return None
            
        return self.parse_to_json(raw_text)


# --- Execution and Testing ---
# --- Execution and Testing ---
if __name__ == "__main__":
    # Initialize the pipeline once
    pipeline = InvoicePipeline()
    
    # Target your specific test file
    sample_file_path = "batch1-0001.jpg" 
    
    # Define where you want the JSON file to be saved
    output_file_path = "extracted_invoice.json"
    
    if os.path.exists(sample_file_path):
        # Process the document
        structured_data = pipeline.process_document(sample_file_path)
        
        if structured_data:
            # Output the results to the console so you can see it
            print("\n--- Final Structured Output for ERP ---")
            print(json.dumps(structured_data, indent=4))
            
            # Save the results to a JSON file
            with open(output_file_path, "w", encoding="utf-8") as json_file:
                json.dump(structured_data, json_file, indent=4)
                
            print(f"\n✅ Success! Data saved to {output_file_path}")
        else:
            print("\nPipeline failed to extract structured data.")
            
    else:
        print(f"Test file not found at {sample_file_path}. Please check the path and try again.")