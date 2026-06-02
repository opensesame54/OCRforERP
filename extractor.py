import os
import sys
import json
import logging
import fitz  # PyMuPDF
from paddleocr import PaddleOCR
from mistralai.client import Mistral
import argparse
import numpy as np
import cv2

# Suppress PaddleOCR's verbose debug logs
logging.getLogger("ppocr").setLevel(logging.WARNING)

# --- CRITICAL: Configure Cloud API ---
# Pull the Mistral API key from the environment securely
api_key = os.environ.get("MISTRAL_API_KEY")
if not api_key:
    raise ValueError("MISTRAL_API_KEY environment variable not found. Please set it before running.")

# Initialize the Mistral client globally
mistral_client = Mistral(api_key=api_key)


class InvoicePipeline:
    def __init__(self):
        print("Initializing stable OCR engine (PaddleOCR 2.8.1 / PaddlePaddle 2.6.2)...")
        # Initialize PaddleOCR with stable 2.8.1 syntax
        self.ocr_engine = PaddleOCR(use_angle_cls=True, lang='latin', show_log=False)

    def _preprocess_for_ocr(self, img):
        """Lightweight preprocessing for low-contrast receipts."""
        if img.ndim == 3:
            img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Contrast enhancement with CLAHE
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        img = clahe.apply(img)

        # Denoise + adaptive threshold
        img = cv2.medianBlur(img, 3)
        img = cv2.adaptiveThreshold(
            img,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            31,
            10,
        )
        return img

    def _write_png(self, path, img):
        ok = cv2.imwrite(path, img)
        if not ok:
            print(f"Warning: Failed to write debug image: {path}")

    def _extract_text_from_result(self, result):
        extracted = []
        if result is None:
            return ""

        # result is list of lines for a single image
        if result and isinstance(result[0], (list, tuple)) and len(result[0]) == 2:
            for line in result:
                extracted.append(line[1][0])
            return "\n".join(extracted)

        # result is list of pages (each a list of lines)
        for res in result:
            if res is not None:
                for line in res:
                    extracted.append(line[1][0])
        return "\n".join(extracted)

    def _ocr_best_of(self, images):
        best_text = ""
        for img in images:
            result = self.ocr_engine.ocr(img, cls=True)
            text = self._extract_text_from_result(result)
            if len(text.strip()) > len(best_text.strip()):
                best_text = text
        return best_text

    def extract_text_from_native_pdf(self, file_path):
        """The Fast Path: Extracts embedded text directly using PyMuPDF."""
        print("Executing Fast Path (PyMuPDF)...")
        text = ""
        with fitz.open(file_path) as pdf:
            for page in pdf:
                text += page.get_text()
        return text

    def is_scanned_pdf(self, file_path, min_text_chars=80, image_ratio_threshold=0.5):
        """Heuristic scan detection: low text density or image-heavy pages."""
        text_chars = 0
        image_pages = 0
        with fitz.open(file_path) as pdf:
            for page in pdf:
                text = page.get_text()
                text_chars += sum(1 for ch in text if ch.isalnum())
                if page.get_images(full=True):
                    image_pages += 1

        page_count = max(len(fitz.open(file_path)), 1)
        image_ratio = image_pages / page_count
        return text_chars < min_text_chars or image_ratio >= image_ratio_threshold

    def extract_text_with_vision(self, file_path, debug=False):
        """The Heavy Path: Uses PaddleOCR to read pixels from scans or images."""
        print("Executing Heavy Path (PaddleOCR)...")

        debug_dir = None
        if debug:
            debug_dir = os.path.abspath("debug_images")
            os.makedirs(debug_dir, exist_ok=True)
            print(f"Saving debug images to: {debug_dir}")

        file_ext = os.path.splitext(file_path)[1].lower()
        if file_ext == ".pdf":
            images = []
            with fitz.open(file_path) as pdf:
                for page_index, page in enumerate(pdf, start=1):
                    # Render at higher DPI to improve OCR on scans
                    pix = page.get_pixmap(matrix=fitz.Matrix(4, 4), colorspace=fitz.csGRAY, alpha=False)
                    img = np.frombuffer(pix.samples, dtype=np.uint8)
                    img = img.reshape(pix.height, pix.width)
                    if debug:
                        pix_path = os.path.join(debug_dir, f"page_{page_index}_raw.png")
                        pix.save(pix_path)
                        print(f"Saved: {pix_path}")
                    img_pre = self._preprocess_for_ocr(img)
                    img_inv = 255 - img_pre
                    if debug:
                        pre_path = os.path.join(debug_dir, f"page_{page_index}_pre.png")
                        inv_path = os.path.join(debug_dir, f"page_{page_index}_inv.png")
                        self._write_png(pre_path, img_pre)
                        self._write_png(inv_path, img_inv)
                        print(f"Saved: {pre_path}")
                        print(f"Saved: {inv_path}")
                    images.append(img)
                    images.append(img_pre)
                    images.append(img_inv)
            text = self._ocr_best_of(images)
            return text
        else:
            result = self.ocr_engine.ocr(file_path, cls=True)
        
        return self._extract_text_from_result(result)

    def parse_to_json(self, raw_text):
        """Passes the raw text to Mistral's Cloud API to structure it into JSON."""
        print("Parsing extracted text with Cloud API (Mistral)...")
        
        # Define the exact schema required for Odoo injection
        prompt = f"""
        Extract the invoice details from the raw text below.
        You must reply ONLY with a valid JSON object matching this schema, nothing else.
        {{
            "vendor_name": "String",
            "invoice_date": "YYYY-MM-DD",
            "invoice_number": "String",
            "tax_id": "String or null",
            "payment_method": "String or null",
            "subtotal_amount": Float,
            "tax_amount": Float,
            "tip_amount": Float,
            "total_amount": Float,
            "authorized_amount": Float,
            "line_items": [
                {{"description": "String", "quantity": Float, "unit_price": Float, "total": Float}}
            ]
        }}
        
        Raw OCR Text:
        ---
        {raw_text}
        ---
        """
        
        try:
            # Call Mistral API with strict JSON mode when supported
            response = mistral_client.chat.complete(
                model="mistral-small-latest",
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
                response_format={"type": "json_object"}
            )
            
            # Extract and parse the JSON string from the response
            json_string = response.choices[0].message.content
            try:
                return json.loads(json_string)
            except json.JSONDecodeError:
                # Best-effort extraction for older SDKs without JSON mode
                start = json_string.find("{")
                end = json_string.rfind("}")
                if start != -1 and end != -1 and end > start:
                    return json.loads(json_string[start:end + 1])
                raise
            
        except Exception as e:
            print(f"Failed to process via Cloud API. Error: {e}")
            return None

    def process_document(self, file_path, debug=False, force_ocr=False):
        """The Router: Decides which extraction path to take."""
        print(f"\nProcessing: {file_path}")
        file_ext = os.path.splitext(file_path)[1].lower()
        print(f"Detected extension: {file_ext}")
        raw_text = ""

        # 1. Image Path
        if file_ext in ['.jpg', '.jpeg', '.png', '.tiff']:
            raw_text = self.extract_text_with_vision(file_path, debug=debug)

        # 2. PDF Path
        elif file_ext == '.pdf':
            if force_ocr:
                print("Force OCR enabled. Using vision engine for PDF...")
                raw_text = self.extract_text_with_vision(file_path, debug=debug)
            else:
                if self.is_scanned_pdf(file_path):
                    print("PDF appears to be a scan. Using vision engine...")
                    raw_text = self.extract_text_with_vision(file_path, debug=debug)
                else:
                    print("Native PDF detected. Using text layer...")
                    raw_text = self.extract_text_from_native_pdf(file_path)
        else:
            raise ValueError(f"Unsupported file format: {file_ext}")

        # 3. Cloud LLM Parsing
        if debug:
            preview = raw_text[:2000]
            print("\n--- OCR TEXT PREVIEW (first 2000 chars) ---")
            print(preview if preview else "<EMPTY>")
            with open("raw_ocr.txt", "w", encoding="utf-8") as f:
                f.write(raw_text)
            print("\nSaved full OCR text to raw_ocr.txt")

        if not raw_text.strip():
            print("Warning: No text could be extracted from the document.")
            return None
            
        return self.parse_to_json(raw_text)


# --- Execution and Testing ---
# --- Execution and Testing ---
if __name__ == "__main__":
    # Set up the command-line argument parser
    parser = argparse.ArgumentParser(description="Process an invoice and extract data to JSON using PaddleOCR and Mistral AI.")
    
    # Required positional argument: the input file
    parser.add_argument("input_file", help="Path to the invoice file (PDF, JPG, PNG, etc.)")
    
    # Optional argument: where to save the output (defaults to extracted_invoice.json)
    parser.add_argument("-o", "--output", default="extracted_invoice.json", 
                        help="Path to save the extracted JSON (default: extracted_invoice.json)")
    parser.add_argument("--debug", action="store_true", help="Print and save raw OCR text")
    parser.add_argument("--force-ocr", action="store_true", help="Force OCR on PDFs (skip native text)")
    
    args = parser.parse_args()
    
    # Check if the provided file actually exists
    if not os.path.exists(args.input_file):
        print(f"❌ Error: File not found at '{args.input_file}'")
        sys.exit(1)
        
    # Initialize and run the pipeline
    pipeline = InvoicePipeline()
    structured_data = pipeline.process_document(
        args.input_file,
        debug=args.debug,
        force_ocr=args.force_ocr,
    )
    
    if structured_data:
        print("\n--- Final Structured Output for ERP ---")
        print(json.dumps(structured_data, indent=4))
        
        # Save to the user-defined (or default) output path
        with open(args.output, "w", encoding="utf-8") as json_file:
            json.dump(structured_data, json_file, indent=4)
            
        print(f"\n✅ Success! Data saved to {args.output}")
    else:
        print("\n❌ Pipeline failed to extract structured data.")
        sys.exit(1)