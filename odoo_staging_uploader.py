import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - fallback for environments without python-dotenv
    def load_dotenv(*args, **kwargs):
        env_path = Path(__file__).with_name(".env")
        if not env_path.exists():
            return False
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
        return True

import requests


DEFAULT_STAGING_MODEL = "x_invoice_staging"
DEFAULT_LINE_MODEL = "x_invoice_staging_line"


def normalize_float(value: Any) -> float:
    try:
        return float(value)
    except Exception:
        return 0.0


class OdooClient:
    def __init__(self, base_url: str, db: str, login: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self.db = db
        self.login = login
        self.api_key = api_key
        self.uid: Optional[int] = None
        self._request_id = 0

    def _rpc(self, method: str, params: Dict[str, Any]) -> Any:
        self._request_id += 1
        payload = {
            "jsonrpc": "2.0",
            "method": "call",
            "params": params,
            "id": self._request_id,
        }
        response = requests.post(
            f"{self.base_url}/jsonrpc",
            json=payload,
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        if data.get("error"):
            raise RuntimeError(data["error"])
        return data.get("result")

    def authenticate(self) -> int:
        result = self._rpc(
            "call",
            {
                "service": "common",
                "method": "authenticate",
                "args": [self.db, self.login, self.api_key, {}],
            },
        )
        if not result:
            raise RuntimeError("Odoo authentication failed")
        self.uid = result
        return result

    def execute_kw(self, model: str, method: str, args: List[Any], kwargs: Optional[Dict[str, Any]] = None) -> Any:
        if self.uid is None:
            self.authenticate()
        return self._rpc(
            "call",
            {
                "service": "object",
                "method": "execute_kw",
                "args": [self.db, self.uid, self.api_key, model, method, args, kwargs or {}],
            },
        )


def load_json_payload(json_path: str) -> Dict[str, Any]:
    with open(json_path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def build_line_commands(payload: Dict[str, Any], line_model: str) -> List[Any]:
    commands: List[Any] = []
    for line in payload.get("line_items", []) or []:
        commands.append(
            (
                0,
                0,
                {
                    "x_description": line.get("description", ""),
                    "x_quantity": normalize_float(line.get("quantity")),
                    "x_unit_price": normalize_float(line.get("unit_price")),
                    "x_total": normalize_float(line.get("total")),
                },
            )
        )
    return commands


def calculate_payload_hash(payload: Dict[str, Any]) -> str:
    normalized = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def upload_pdf_attachment(client: OdooClient, model: str, res_id: int, pdf_path: str) -> int:
    if not pdf_path:
        return 0

    pdf_file = Path(pdf_path)
    if not pdf_file.exists():
        raise FileNotFoundError(f"PDF attachment not found: {pdf_path}")

    with open(pdf_file, "rb") as handle:
        pdf_data = base64.b64encode(handle.read()).decode("ascii")

    attachment_id = client.execute_kw(
        "ir.attachment",
        "create",
        [
            {
                "name": pdf_file.name,
                "type": "binary",
                "datas": pdf_data,
                "mimetype": "application/pdf",
                "res_model": model,
                "res_id": res_id,
            }
        ],
    )
    return attachment_id


def create_staging_record(
    client: OdooClient,
    payload: Dict[str, Any],
    pdf_path: Optional[str],
    staging_model: str,
    line_model: str,
    review_threshold: float,
) -> int:
    ocr_confidence = normalize_float(payload.get("ocr_confidence"))
    needs_review = bool(payload.get("needs_review")) or ocr_confidence < review_threshold
    status = "draft" if needs_review else "approved"

    values = {
        "x_name": f"{payload.get('vendor_name', '')} - {payload.get('invoice_number', '')}".strip(" -"),
        "x_vendor_name": payload.get("vendor_name") or "",
        "x_invoice_number": payload.get("invoice_number") or "",
        "x_invoice_date": payload.get("invoice_date") or False,
        "x_tax_id": payload.get("tax_id") or "",
        "x_payment_method": payload.get("payment_method") or "",
        "x_subtotal_amount": normalize_float(payload.get("subtotal_amount")),
        "x_tax_amount": normalize_float(payload.get("tax_amount")),
        "x_total_amount": normalize_float(payload.get("total_amount")),
        "x_authorized_amount": normalize_float(payload.get("authorized_amount")),
        "x_ocr_confidence": ocr_confidence,
        "x_needs_review": needs_review,
        "x_status": status,
        "x_json_payload": json.dumps(payload, ensure_ascii=False, indent=2),
        #"x_error_message": "",
        "x_line_ids": build_line_commands(payload, line_model),
    }

    if pdf_path:
        values["x_status"] = "draft" if needs_review else status

    staging_id = client.execute_kw(staging_model, "create", [values])

    if pdf_path:
        upload_pdf_attachment(client, staging_model, staging_id, pdf_path)

    return staging_id


def main() -> int:
    load_dotenv()

    parser = argparse.ArgumentParser(description="Upload extracted invoice JSON to Odoo staging model")
    parser.add_argument("json_file", help="Path to extracted invoice JSON")
    parser.add_argument("--pdf", help="Optional path to source PDF to attach")
    parser.add_argument("--review-threshold", type=float, default=float(os.getenv("OCR_REVIEW_THRESHOLD", "0.75")))
    parser.add_argument("--staging-model", default=os.getenv("ODOO_STAGING_MODEL", DEFAULT_STAGING_MODEL))
    parser.add_argument("--line-model", default=os.getenv("ODOO_STAGING_LINE_MODEL", DEFAULT_LINE_MODEL))
    args = parser.parse_args()

    base_url = os.environ.get("ODOO_URL")
    db = os.environ.get("ODOO_DB")
    login = os.environ.get("ODOO_LOGIN")
    api_key = os.environ.get("ODOO_API_KEY")

    if not all([base_url, db, login, api_key]):
        raise ValueError(
            "Missing Odoo configuration. Set ODOO_URL, ODOO_DB, ODOO_LOGIN, and ODOO_API_KEY in .env"
        )

    payload = load_json_payload(args.json_file)
    client = OdooClient(base_url=base_url, db=db, login=login, api_key=api_key)

    staging_id = create_staging_record(
        client=client,
        payload=payload,
        pdf_path=args.pdf,
        staging_model=args.staging_model,
        line_model=args.line_model,
        review_threshold=args.review_threshold,
    )

    print(json.dumps({"staging_id": staging_id, "status": "uploaded"}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())