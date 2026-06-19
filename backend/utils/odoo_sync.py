import os
import json
import sys
from pathlib import Path

# Load environment configuration
env_path = Path(__file__).resolve().parent.parent.parent / '.env'
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

from odoo_staging_uploader import OdooClient, normalize_float

def sync_from_odoo():
    base_url = os.environ.get("ODOO_URL")
    db = os.environ.get("ODOO_DB")
    login = os.environ.get("ODOO_LOGIN")
    api_key = os.environ.get("ODOO_API_KEY")

    if not all([base_url, db, login, api_key]):
        print(json.dumps({"error": "Missing Odoo configuration in .env"}))
        sys.exit(1)

    client = OdooClient(base_url, db, login, api_key)
    try:
        client.authenticate()
    except Exception as e:
        print(json.dumps({"error": f"Odoo auth failed: {str(e)}"}))
        sys.exit(1)

    # Search all staging records
    try:
        fields = [
            "id",
            "x_name",
            "x_vendor_name",
            "x_invoice_number",
            "x_invoice_date",
            "x_tax_id",
            "x_payment_method",
            "x_subtotal_amount",
            "x_tax_amount",
            "x_tip_amount",
            "x_total_amount",
            "x_authorized_amount",
            "x_ocr_confidence",
            "x_needs_review",
            "x_status",
            "x_json_payload",
            "x_line_ids",
            "x_vendor_bill_id",
            "x_invoice_upload"
        ]
        
        stagings = client.execute_kw(
            "x_invoice_staging",
            "search_read",
            [[]],
            {"fields": fields, "limit": 100}
        )
    except Exception as e:
        print(json.dumps({"error": f"Failed to search staging records: {str(e)}"}))
        sys.exit(1)

    synced_invoices = []
    
    for s in stagings:
        invoice_id = s.get("id")
        vendor_name = s.get("x_vendor_name") or ""
        invoice_number = s.get("x_invoice_number") or ""
        invoice_date = s.get("x_invoice_date") or ""
        tax_id = s.get("x_tax_id") or ""
        subtotal = normalize_float(s.get("x_subtotal_amount"))
        tax = normalize_float(s.get("x_tax_amount"))
        total = normalize_float(s.get("x_total_amount"))
        confidence = normalize_float(s.get("x_ocr_confidence"))
        status = s.get("x_status") or "draft"
        
        # Determine status string mapping
        # x_status options in Odoo: draft, approved, posted
        status_map = {
            "draft": "Needs Review",
            "approved": "Approved",
            "posted": "Posted to ERP"
        }
        mapped_status = status_map.get(status, "Needs Review")

        line_items = []
        vendor_address = ""
        payment_terms = "Net 30"
        currency = "INR"

        # 1. Try parsing line items and additional metadata from JSON payload if present
        json_payload_str = s.get("x_json_payload")
        parsed_from_json = False
        if json_payload_str:
            try:
                payload = json.loads(json_payload_str)
                currency = payload.get("currency") or currency
                payment_terms = payload.get("payment_terms") or payment_terms
                vendor_address = payload.get("vendor_address") or vendor_address
                
                for line in payload.get("line_items", []):
                    line_items.append({
                        "description": line.get("description", ""),
                        "quantity": normalize_float(line.get("quantity")),
                        "unitPrice": normalize_float(line.get("unit_price")),
                        "taxPercent": normalize_float(line.get("vat") or line.get("tax_percent") or 10),
                        "total": normalize_float(line.get("total"))
                    })
                parsed_from_json = True
            except Exception:
                pass

        # 2. Fallback to reading lines directly from related x_invoice_staging_line
        if not parsed_from_json and s.get("x_line_ids"):
            try:
                line_ids = s.get("x_line_ids")
                lines = client.execute_kw(
                    "x_invoice_staging_line",
                    "read",
                    [line_ids],
                    {"fields": ["x_description", "x_quantity", "x_unit_price", "x_total"]}
                )
                for line in lines:
                    line_items.append({
                        "description": line.get("x_description") or "",
                        "quantity": normalize_float(line.get("x_quantity")),
                        "unitPrice": normalize_float(line.get("x_unit_price")),
                        "taxPercent": 10,
                        "total": normalize_float(line.get("x_total"))
                    })
            except Exception:
                pass

        # 3. Handle Attachment
        attachment_name = ""
        attachment_data = ""
        invoice_upload = s.get("x_invoice_upload")
        
        # Try getting attachment by id in x_invoice_upload first
        attachment_id = None
        if invoice_upload:
            if isinstance(invoice_upload, list) and invoice_upload:
                attachment_id = invoice_upload[0]
            elif isinstance(invoice_upload, int):
                attachment_id = invoice_upload
        
        # If no explicit attachment id, search ir.attachment linked to x_invoice_staging
        if not attachment_id:
            try:
                attachments = client.execute_kw(
                    "ir.attachment",
                    "search",
                    [[["res_model", "=", "x_invoice_staging"], ["res_id", "=", invoice_id]]],
                    {"limit": 1}
                )
                if attachments:
                    attachment_id = attachments[0]
            except Exception:
                pass

        if attachment_id:
            try:
                attachments = client.execute_kw(
                    "ir.attachment",
                    "read",
                    [[attachment_id]],
                    {"fields": ["name", "raw"]}
                )
                if attachments:
                    att = attachments[0]
                    attachment_name = att.get("name") or ""
                    attachment_data = att.get("raw") or ""
            except Exception:
                pass

        synced_invoices.append({
            "odooStagingId": invoice_id,
            "invoiceNumber": invoice_number,
            "vendorName": vendor_name,
            "vendorAddress": vendor_address,
            "invoiceDate": invoice_date,
            "paymentTerms": payment_terms,
            "currency": currency,
            "subtotalAmount": subtotal,
            "taxAmount": tax,
            "totalAmount": total,
            "gstin": tax_id,
            "status": mapped_status,
            "confidenceScore": confidence if confidence > 0 else 0.85,
            "lineItems": line_items,
            "attachmentName": attachment_name,
            "attachmentData": attachment_data, # base64
        })

    print(json.dumps(synced_invoices, indent=2))

if __name__ == "__main__":
    sync_from_odoo()
