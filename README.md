# ERP OCR Invoice Extractor

This project extracts structured invoice data from PDFs or images using OCR and Mistral's LLM. It supports native-text PDFs, scanned PDFs, and image files. Output is saved as JSON for downstream ERP ingestion.

## What It Does

- Detects whether a PDF is scanned or text-based.
- Uses PyMuPDF to read native PDF text when available.
- Uses PaddleOCR for scanned PDFs and image files.
- Sends the extracted text to Mistral to structure it into JSON.
- Saves the JSON output to a file.

## Requirements

- Python 3.11+
- Mistral API key in environment: `MISTRAL_API_KEY`

Install dependencies (example):

```bash
python -m venv .venv
source .venv/bin/activate
pip install pymupdf paddleocr mistralai opencv-python numpy
```

## Usage

Basic:

```bash
python extractor.py path/to/invoice.pdf
```

Specify output path:

```bash
python extractor.py path/to/invoice.pdf -o output.json
```

Debug OCR text and save intermediate images:

```bash
python extractor.py path/to/invoice.pdf --debug
```

Force OCR for PDFs (skip native text layer):

```bash
python extractor.py path/to/invoice.pdf --force-ocr
```

## Output Schema

The model is instructed to output a JSON object with this structure:

```json
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
```

## Scan Detection Heuristic

PDFs are considered scanned if:

- The text layer has too few alphanumeric characters, or
- A significant portion of pages contain images

This avoids unnecessary OCR for text-based PDFs and enables OCR for scans.

## Debugging Tips

- Use `--debug` to save OCR text to `raw_ocr.txt` and write debug images to `debug_images/`.
- If the OCR text is garbage, inspect the debug images to verify readability.
- Use `--force-ocr` for PDFs that are misclassified.

## Files

- `extractor.py`: Main pipeline
- `extracted_invoice.json`: Example output
- `raw_ocr.txt`: Debug OCR output (when `--debug` is used)
- `debug_images/`: Debug renders (when `--debug` is used)
