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
api_key = os.environ.get("MISTRAL_API_KEY")
if not api_key:
    raise ValueError("MISTRAL_API_KEY environment variable not found. Please set it before running.")

# Initialize the Mistral client globally
mistral_client = Mistral(api_key=api_key)

class InvoicePipeline:
    def __init__(self):
        print("Initializing stable OCR engine (PaddleOCR 2.8.1 / PaddlePaddle 2.6.2)...")
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
            img, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 10
        )
        return img

    def _write_png(self, path, img):
        ok = cv2.imwrite(path, img)
        if not ok:
            print(f"Warning: Failed to write debug image: {path}")

    def _extract_text_from_result(self, result):
        """Extracts text while injecting Y-coordinates to prevent table row bleeding."""
        extracted = []
        confidences = []
        if result is None:
            return "", 0.0

        # result is list of lines for a single image
        if result and isinstance(result[0], (list, tuple)) and len(result[0]) == 2:
            for line in result:
                box = line[0]
                text = line[1][0]
                conf = line[1][1]
                y_center = self._safe_y_center(box)
                if y_center is None:
                    continue
                extracted.append(f"[Y:{y_center:04d}] {text}")
                if isinstance(conf, (int, float)):
                    confidences.append(conf)
            avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
            return "\n".join(extracted), avg_conf

        # result is list of pages (each a list of lines)
        for res in result:
            if res is not None:
                for line in res:
                    box = line[0]
                    text = line[1][0]
                    conf = line[1][1]
                    y_center = self._safe_y_center(box)
                    if y_center is None:
                        continue
                    extracted.append(f"[Y:{y_center:04d}] {text}")
                    if isinstance(conf, (int, float)):
                        confidences.append(conf)
        avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
        return "\n".join(extracted), avg_conf

    def _ocr_best_of(self, images):
        best_text = ""
        best_conf = 0.0
        for img in images:
            result = self.ocr_engine.ocr(img, cls=True)
            text, conf = self._extract_text_from_result(result)
            if len(text.strip()) > len(best_text.strip()):
                best_text = text
                best_conf = conf
        return best_text, best_conf

    def _safe_y_center(self, box):
        if not box or len(box) < 2:
            return None
        try:
            y_values = []
            for pt in box:
                if not isinstance(pt, (list, tuple)) or len(pt) < 2:
                    continue
                y = pt[1]
                if isinstance(y, (int, float)):
                    y_values.append(y)
                elif isinstance(y, (list, tuple)):
                    for y_item in y:
                        if isinstance(y_item, (int, float)):
                            y_values.append(y_item)
        except Exception:
            return None
        if not y_values:
            return None
        return int(sum(y_values) / len(y_values))

    def extract_text_from_native_pdf(self, file_path):
        print("Executing Fast Path (PyMuPDF)...")
        text = ""
        with fitz.open(file_path) as pdf:
            for page in pdf:
                text += page.get_text()
        return text

    def is_scanned_pdf(self, file_path, min_text_chars=80, image_ratio_threshold=0.5):
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
        print("Executing Heavy Path (PaddleOCR)...")
        debug_dir = None
        if debug:
            debug_dir = os.path.abspath("debug_images")
            os.makedirs(debug_dir, exist_ok=True)

        file_ext = os.path.splitext(file_path)[1].lower()
        if file_ext == ".pdf":
            images = []
            with fitz.open(file_path) as pdf:
                for page_index, page in enumerate(pdf, start=1):
                    pix = page.get_pixmap(matrix=fitz.Matrix(4, 4), colorspace=fitz.csGRAY, alpha=False)
                    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width)
                    img_pre = self._preprocess_for_ocr(img)
                    img_inv = 255 - img_pre
                    images.extend([img, img_pre, img_inv])
            return self._ocr_best_of(images)
        else:
            # Added preprocessing for JPEGs to improve base OCR accuracy
            img = cv2.imread(file_path)
            if img is not None:
                img_pre = self._preprocess_for_ocr(img)
                result = self.ocr_engine.ocr(img_pre, cls=True)
            else:
                result = self.ocr_engine.ocr(file_path, cls=True)
            return self._extract_text_from_result(result)

    def parse_to_json(self, raw_text, is_pdf=False):
        """Routes the prompt schema based on whether the source was a PDF or Image."""
        print(f"Parsing extracted text with Cloud API (Mistral)... [PDF Mode: {is_pdf}]")
        
        # Define base instructions regarding the spatial coordinates
        system_instruction = """
        Extract the invoice details from the raw text below.
        CRITICAL INSTRUCTIONS FOR LINE ITEMS:
        1. The text includes vertical Y-coordinates (e.g., [Y:0150]). Use these to group items that belong on the same row.
        2. Descriptions often span multiple lines. Do not cut them off prematurely.
        3. You must reply ONLY with a valid JSON object matching the requested schema, nothing else.
        """

        # Choose the exact schema based on file type
        if is_pdf:
            # Schema 2: The complex 10-field PDF prompt
            schema = """
            {
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
                    {"description": "String", "quantity": Float, "unit_price": Float, "total": Float}
                ]
            }
            """
        else:
            # Schema 1: The simpler 6-field Image prompt
            schema = """
            {
                "vendor_name": "String",
                "invoice_date": "YYYY-MM-DD",
                "invoice_number": "String",
                "tax_id": "String or null",
                "total_amount": Float,
                "line_items": [
                    {"description": "String", "quantity": Float, "unit_price": Float, "total": Float}
                ]
            }
            """

        prompt = f"""
        {system_instruction}
        
        SCHEMA:
        {schema}
        
        Raw OCR Text:
        ---
        {raw_text}
        ---
        """
        
        try:
            response = mistral_client.chat.complete(
                model="mistral-small-latest",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            json_string = response.choices[0].message.content
            try:
                return json.loads(json_string)
            except json.JSONDecodeError:
                start = json_string.find("{")
                end = json_string.rfind("}")
                if start != -1 and end != -1 and end > start:
                    return json.loads(json_string[start:end + 1])
                raise
        except Exception as e:
            print(f"Failed to process via Cloud API. Error: {e}")
            return None

    def process_document(self, file_path, debug=False, force_ocr=False):
        print(f"\nProcessing: {file_path}")
        file_ext = os.path.splitext(file_path)[1].lower()
        print(f"Detected extension: {file_ext}")
        raw_text = ""
        ocr_conf = 0.0
        is_pdf = (file_ext == '.pdf')

        if file_ext in ['.jpg', '.jpeg', '.png', '.tiff']:
            raw_text, ocr_conf = self.extract_text_with_vision(file_path, debug=debug)
        elif is_pdf:
            if force_ocr:
                print("Force OCR enabled. Using vision engine for PDF...")
                raw_text, ocr_conf = self.extract_text_with_vision(file_path, debug=debug)
            else:
                if self.is_scanned_pdf(file_path):
                    print("PDF appears to be a scan. Using vision engine...")
                    raw_text, ocr_conf = self.extract_text_with_vision(file_path, debug=debug)
                else:
                    print("Native PDF detected. Using text layer...")
                    raw_text = self.extract_text_from_native_pdf(file_path)
                    ocr_conf = 1.0
        else:
            raise ValueError(f"Unsupported file format: {file_ext}")

        if debug:
            preview = raw_text[:2000]
            print("\n--- OCR TEXT PREVIEW (first 2000 chars) ---")
            print(preview if preview else "<EMPTY>")
            with open("raw_ocr.txt", "w", encoding="utf-8") as f:
                f.write(raw_text)

        if not raw_text.strip():
            print("Warning: No text could be extracted from the document.")
            return None
            
        # Pass the is_pdf flag down to the parser to determine which schema to use
        parsed = self.parse_to_json(raw_text, is_pdf=is_pdf)
        if parsed is None:
            return None

        parsed["ocr_confidence"] = round(ocr_conf, 4)
        parsed["needs_review"] = ocr_conf < 0.75
        return parsed


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process an invoice and extract data to JSON using PaddleOCR and Mistral AI.")
    parser.add_argument("input_file", help="Path to the invoice file (PDF, JPG, PNG, etc.)")
    parser.add_argument("-o", "--output", default="extracted_invoice.json", help="Path to save the extracted JSON")
    parser.add_argument("--debug", action="store_true", help="Print and save raw OCR text")
    parser.add_argument("--force-ocr", action="store_true", help="Force OCR on PDFs (skip native text)")
    
    args = parser.parse_args()
    
    if not os.path.exists(args.input_file):
        print(f"❌ Error: File not found at '{args.input_file}'")
        sys.exit(1)
        
    pipeline = InvoicePipeline()
    structured_data = pipeline.process_document(
        args.input_file,
        debug=args.debug,
        force_ocr=args.force_ocr,
    )
    
    if structured_data:
        print("\n--- Final Structured Output ---")
        print(json.dumps(structured_data, indent=4))
        
        with open(args.output, "w", encoding="utf-8") as json_file:
            json.dump(structured_data, json_file, indent=4)
            
        print(f"\n✅ Success! Data saved to {args.output}")
    else:
        print("\n❌ Pipeline failed to extract structured data.")
        sys.exit(1)