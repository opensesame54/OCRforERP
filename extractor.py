import os
import sys
import json
import logging
import re
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
mistral_client = None
if api_key:
    mistral_client = Mistral(api_key=api_key)


def normalize_float(value):
    try:
        if value is None:
            return 0.0
        return float(value)
    except Exception:
        return 0.0

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
        """
        Extract OCR text in proper reading order:
        1. collect text boxes
        2. sort by Y position
        3. group nearby Y positions into rows
        4. sort each row left-to-right by X
        """
        if result is None:
            return "", 0.0

        lines = []
        confidences = []

        # PaddleOCR may return [lines] or [[lines]]
        if result and isinstance(result[0], list) and result[0] and isinstance(result[0][0], list):
            ocr_lines = result[0]
        else:
            ocr_lines = result

        for line in ocr_lines:
            try:
                box = line[0]
                text = line[1][0]
                conf = line[1][1]

                xs = [pt[0] for pt in box]
                ys = [pt[1] for pt in box]

                x_min = min(xs)
                y_center = sum(ys) / len(ys)
                height = max(ys) - min(ys)

                lines.append({
                    "text": text,
                    "x": x_min,
                    "y": y_center,
                    "height": height,
                    "conf": conf
                })

                if isinstance(conf, (int, float)):
                    confidences.append(conf)

            except Exception:
                continue

        if not lines:
            return "", 0.0

        # Sort top-to-bottom first
        lines.sort(key=lambda item: item["y"])

        rows = []
        current_row = []
        current_y = None

        # Dynamic row tolerance based on OCR box height
        avg_height = sum(line["height"] for line in lines) / len(lines)
        y_tolerance = max(10, avg_height * 0.6)

        for line in lines:
            if current_y is None:
                current_row = [line]
                current_y = line["y"]
            elif abs(line["y"] - current_y) <= y_tolerance:
                current_row.append(line)
                current_y = (current_y + line["y"]) / 2
            else:
                rows.append(current_row)
                current_row = [line]
                current_y = line["y"]

        if current_row:
            rows.append(current_row)

        output_lines = []

        for row in rows:
            # Sort each row left-to-right
            row.sort(key=lambda item: item["x"])

            row_y = int(sum(item["y"] for item in row) / len(row))
            row_text = " | ".join(item["text"] for item in row)

            output_lines.append(f"[Y:{row_y:04d}] {row_text}")

        output_lines = self._repair_missing_table_numbers(output_lines)
        avg_conf = sum(confidences) / len(confidences) if confidences else 0.0

        return "\n".join(output_lines), avg_conf

    def _repair_missing_table_numbers(self, output_lines):
        repaired = []
        expected_no = 1
        inside_items = False

        for line in output_lines:
            text = line

            if "ITEMS" in text.upper() or "LTEMS" in text.upper():
                inside_items = True
                repaired.append(text)
                continue

            if "SUMMARY" in text.upper():
                inside_items = False
                repaired.append(text)
                continue

            if inside_items:
                # Already starts with correct row number
                match = re.search(r"\]\s*(\d+)\.?\s*\|", text)
                if match:
                    expected_no = int(match.group(1)) + 1
                    repaired.append(text)
                    continue

                # Looks like a table row because it has qty, unit, prices, VAT
                looks_like_item_row = (
                    "|" in text
                    and re.search(r"\|\s*\d+[,.]\d{2}\s*\|", text)
                    and re.search(r"\|\s*each\s*\|", text, re.IGNORECASE)
                    and re.search(r"\|\s*\d+%\s*\|", text)
                )

                if looks_like_item_row:
                    text = re.sub(r"\]\s*", f"] {expected_no}. | ", text, count=1)
                    expected_no += 1

            repaired.append(text)

        return repaired

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
                result = self.ocr_engine.ocr(img, cls=True)
            else:
                result = self.ocr_engine.ocr(file_path, cls=True)
            return self._extract_text_from_result(result)

    def parse_to_json(self, raw_text, is_pdf=False):
        """Routes the prompt schema based on whether the source was a PDF or Image."""
        print(f"Parsing extracted text with Cloud API (Mistral)... [PDF Mode: {is_pdf}]")
        
        # Define base instructions regarding the spatial coordinates
        system_instruction = """
            You are an expert Accounts Payable invoice extraction system.
    
            Your job is to convert OCR text into accurate structured invoice JSON.
    
            The OCR text contains vertical coordinates in the format:
    
            [Y:0123]
    
            These coordinates represent the approximate vertical position of text on the page and MUST be used to reconstruct tables and multi-line descriptions.
    
            ==================================================
            GENERAL RULES
            ==================================================
    
            1. Return ONLY valid JSON.
            2. Do not include explanations.
            3. Do not include markdown.
            4. Do not invent values.
            5. Use null when a value is genuinely unavailable.
            6. Dates must be returned as YYYY-MM-DD.
            7. Monetary values must be numeric floats.
            8. Quantities must be numeric floats.
            9. Detect invoice currency and return ISO code:
               USD, EUR, GBP, INR, CAD, AUD, JPY, CHF, etc.
    
            ==================================================
            VENDOR INFORMATION
            ==================================================
    
            Extract:
    
            - vendor_name
            - vendor_address
            - invoice_number
            - invoice_date
            - tax_id
            - payment_method
    
            Vendor name is the seller/supplier.
            Vendor address is the seller/supplier address.
            Include street, city, state/region, postal code, and country if available.
            Do not use the customer/client/buyer address.
    
            Ignore:
            - customer information
            - buyer information
            - shipping addresses
    
            ==================================================
            TOTALS EXTRACTION
            ==================================================
    
            Extract separately:
    
            - subtotal_amount
            - tax_amount
            - tip_amount
            - total_amount
            - authorized_amount
    
            Definitions:
    
            subtotal_amount:
                Amount before tax.
    
            tax_amount:
                VAT/GST/Sales Tax amount.
    
            tip_amount:
                Gratuity/tip amount.
    
            total_amount:
                Final invoice amount.
    
            authorized_amount:
                Final charged card amount.
                Often appears on receipts.
    
            ==================================================
            TAX DETECTION
            ==================================================
    
            Look for labels such as:
    
            VAT
            GST
            Sales Tax
            Tax
            MwSt
            Umsatzsteuer
            IVA
            TVA
    
            Examples:
    
            VAT 19%
            Tax 8.25%
            GST
    
            Extract the actual tax amount separately.
    
            Never create tax as a line item.
    
            ==================================================
            RESTAURANT RECEIPTS
            ==================================================
    
            For receipts:
    
            Food items -> line_items
    
            Sales tax -> tax_amount
    
            Tip / Gratuity -> tip_amount
    
            Card authorization amount -> authorized_amount
    
            ==================================================
            LINE ITEM EXTRACTION
            ==================================================
    
            CRITICAL:
    
            Each JSON line item must represent ONE purchased item.
    
            Do NOT create line items from:
    
            - SKU codes
            - product identifiers
            - item numbers
            - VAT rows
            - totals
            - footer text
            - tax summaries
            - account references
    
            ==================================================
            MULTI-LINE DESCRIPTIONS
            ==================================================
    
            Descriptions frequently span multiple OCR lines.
    
            Example:
    
            1.
            Dell Optiplex 990 MT Computer
            PC Quad Core i7 3.4GHz 16GB
            2TB HD Windows 10 Pro
    
            This is ONE line item.
    
            Merge all continuation lines until the next item begins.
    
            ==================================================
            TABLE INVOICES
            ==================================================
    
            For table-style invoices:
    
            Rows often begin with:
    
            1.
            2.
            3.
            4.
    
            These indicate actual invoice rows.
    
            Rules:
    
            - Each numbered row becomes exactly one JSON line item.
            - Any following text belongs to that same row until the next row number appears.
            - Do not split descriptions across multiple JSON items.
            - If the invoice table has rows 1 through 7, return exactly 7 line_items.
    
            ==================================================
            PRICE EXTRACTION
            ==================================================
    
            Each line item should contain:
    
            description
            quantity
            unit_price
            total
    
            Prefer:
    
            Net amount
            Net worth
            Line total
    
            over gross invoice totals.
    
            Invoice grand totals must NEVER become line item prices.
    
            ==================================================
            PRODUCT CODES
            ==================================================
    
            Examples:
    
            3G17-01G
            CP0000036013454
            ABC-123
    
            These are NOT line items.
    
            Attach them to the nearest product description if relevant.
    
            Never create standalone JSON items from product codes.
    
            ==================================================
            VALIDATION RULES
            ==================================================
    
            After extraction:
    
            1. Sum all line item totals.
    
            2. Compare with subtotal_amount.
    
            3. If discrepancy exceeds 5%:
               - reconsider row grouping
               - reconsider product code handling
               - reconsider table reconstruction
    
            4. total_amount should approximately equal:
    
            subtotal_amount + tax_amount + tip_amount
    
            5. authorized_amount may be larger than total_amount if additional card charges appear.
    
            ==================================================
            OCR NOISE
            ==================================================
    
            Ignore:
    
            - page numbers
            - headers
            - footers
            - website URLs
            - barcode text
            - tracking numbers
            - document IDs not related to invoice number
    
            ==================================================
            FINAL OUTPUT
            ==================================================
    
            Return ONLY a JSON object matching the schema.
    
            No explanations.
    
            No markdown.
    
            No extra text.
        """
    
        # Choose the exact schema based on file type
        schema = """
            {
              "vendor_name": "String",
              "vendor_address": "String or null",
              "invoice_date": "YYYY-MM-DD",
              "invoice_number": "String",
              "tax_id": "String or null",
              "currency": "ISO Currency Code or null",
              "payment_method": "String or null",
              "subtotal_amount": Float,
              "tax_amount": Float,
              "tip_amount": Float,
              "total_amount": Float,
              "authorized_amount": Float,
              "line_items": [
                {
                  "description": "String",
                  "quantity": Float,
                  "unit_price": Float,
                  "total": Float
                }
              ]
            }
        """

        prompt = f"""
            {system_instruction}

            EXTRA VALIDATION:

            - Sum all line item totals.
            - Compare against subtotal_amount.
            - If mismatch > 5%, investigate alternative interpretation.
            - Product codes are NOT line items.
            - Tax amounts are NOT line items.
            - Invoice totals are NOT line items.

            SCHEMA:
            {schema}

            OCR TEXT:
            {raw_text}
        """
        
        global mistral_client
        if not mistral_client:
            api_key = os.environ.get("MISTRAL_API_KEY")
            if not api_key:
                raise ValueError("MISTRAL_API_KEY environment variable not found. Please set it in your environment or .env file.")
            mistral_client = Mistral(api_key=api_key)

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
        parsed["needs_review"] = bool(parsed.get("needs_review")) or ocr_conf < 0.75

        line_sum = sum(
            normalize_float(item.get("total"))
        for item in parsed.get("line_items", [])
        )

        subtotal = normalize_float(parsed.get("subtotal_amount"))

        if subtotal > 0:
            diff = abs(line_sum - subtotal)

            if diff > subtotal * 0.05:
                parsed["needs_review"] = True
                parsed["validation_error"] = (
                    f"Line total mismatch: lines={line_sum}, subtotal={subtotal}"
                )

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