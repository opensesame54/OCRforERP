#!/usr/bin/env python3
"""
invoice_pipeline_runner.py

Thin modular pipeline wrapper.

It does NOT merge extractor.py and odoo_staging_uploader.py.
It only imports their existing classes/functions and coordinates two actions:

1. stage
   - Either stages an existing extracted JSON
   - OR extracts from an invoice file first, then stages it

2. post
   - Posts an existing x_invoice_staging record into an Odoo vendor bill

Expected files in the same folder:
- extractor.py
- odoo_staging_uploader.py
- .env with Odoo credentials and MISTRAL_API_KEY
"""

import argparse
import json
import os
import tempfile
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(*args, **kwargs):
        return False

from extractor import InvoicePipeline
from odoo_staging_uploader import (
    OdooClient,
    create_staging_record,
    create_vendor_bill_from_staging,
    load_json_payload,
    DEFAULT_STAGING_MODEL,
    DEFAULT_LINE_MODEL,
)


from odoo_staging_uploader import OdooClient
import os

def get_odoo_client():
    return OdooClient(
        base_url=os.environ["ODOO_URL"],
        db=os.environ["ODOO_DB"],
        login=os.environ["ODOO_LOGIN"],
        api_key=os.environ["ODOO_API_KEY"],
    )

def extract_invoice_to_payload(
    invoice_file: str,
    debug: bool = False,
    force_ocr: bool = False,
) -> dict:
    extractor = InvoicePipeline()
    payload = extractor.process_document(
        invoice_file,
        debug=debug,
        force_ocr=force_ocr,
    )

    if not payload:
        raise RuntimeError("Extraction failed. No structured payload was produced.")

    return payload


def stage_invoice(args) -> int:
    client = get_odoo_client()

    if args.extract_invoice:
        payload = extract_invoice_to_payload(
            invoice_file=args.extract_invoice,
            debug=args.debug,
            force_ocr=args.force_ocr,
        )
        source_file = args.extract_invoice

        if args.save_json:
            with open(args.save_json, "w", encoding="utf-8") as handle:
                json.dump(payload, handle, indent=2, ensure_ascii=False)
    else:
        if not args.json_file:
            raise ValueError(
                "For stage, provide either --extract-invoice INVOICE_FILE "
                "or --json-file EXTRACTED_JSON"
            )

        payload = load_json_payload(args.json_file)
        source_file = args.file

    staging_id = create_staging_record(
        client=client,
        payload=payload,
        pdf_path=source_file,
        staging_model=args.staging_model,
        line_model=args.line_model,
        review_threshold=args.review_threshold,
    )

    print(json.dumps(
        {
            "status": "staged",
            "staging_id": staging_id,
        },
        indent=2,
    ))

    return staging_id


def post_staging(args) -> int:
    if not args.staging_id:
        raise ValueError("For post, provide --staging-id")

    expense_account_id = args.expense_account_id or int(
        os.getenv("ODOO_DEFAULT_EXPENSE_ACCOUNT_ID", "0")
    )

    if not expense_account_id:
        raise ValueError(
            "Missing expense account. Provide --expense-account-id "
            "or set ODOO_DEFAULT_EXPENSE_ACCOUNT_ID in .env"
        )

    client = get_odoo_client()

    bill_id = create_vendor_bill_from_staging(
        client=client,
        staging_id=args.staging_id,
        expense_account_id=expense_account_id,
        staging_model=args.staging_model,
        line_model=args.line_model,
    )

    print(json.dumps(
        {
            "status": "posted",
            "staging_id": args.staging_id,
            "vendor_bill_id": bill_id,
        },
        indent=2,
    ))

    return bill_id


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Modular invoice pipeline runner for extraction, staging, and posting."
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    stage = subparsers.add_parser(
        "stage",
        help="Stage invoice into x_invoice_staging",
    )
    stage.add_argument(
        "--extract-invoice",
        help="Invoice file to extract first, then stage. Example: invoice.pdf",
    )
    stage.add_argument(
        "--json-file",
        help="Existing extracted JSON file to stage instead of extracting.",
    )
    stage.add_argument(
        "--file",
        help="Optional source invoice file to attach when staging from JSON.",
    )
    stage.add_argument(
        "--save-json",
        help="Optional path to save extracted JSON when using --extract-invoice.",
    )
    stage.add_argument(
        "--debug",
        action="store_true",
        help="Enable extractor debug output.",
    )
    stage.add_argument(
        "--force-ocr",
        action="store_true",
        help="Force OCR for PDFs instead of using native PDF text.",
    )
    stage.add_argument(
        "--review-threshold",
        type=float,
        default=float(os.getenv("OCR_REVIEW_THRESHOLD", "0.75")),
    )
    stage.add_argument(
        "--staging-model",
        default=os.getenv("ODOO_STAGING_MODEL", DEFAULT_STAGING_MODEL),
    )
    stage.add_argument(
        "--line-model",
        default=os.getenv("ODOO_STAGING_LINE_MODEL", DEFAULT_LINE_MODEL),
    )

    post = subparsers.add_parser(
        "post",
        help="Post x_invoice_staging record into account.move vendor bill",
    )
    post.add_argument(
        "--staging-id",
        type=int,
        required=True,
        help="Existing x_invoice_staging record ID to post.",
    )
    post.add_argument(
        "--expense-account-id",
        type=int,
        help="Expense account ID for vendor bill lines.",
    )
    post.add_argument(
        "--staging-model",
        default=os.getenv("ODOO_STAGING_MODEL", DEFAULT_STAGING_MODEL),
    )
    post.add_argument(
        "--line-model",
        default=os.getenv("ODOO_STAGING_LINE_MODEL", DEFAULT_LINE_MODEL),
    )

    return parser


def main() -> int:
    load_dotenv()

    parser = build_parser()
    args = parser.parse_args()

    if args.command == "stage":
        stage_invoice(args)
        return 0

    if args.command == "post":
        post_staging(args)
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
