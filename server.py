import os
import shutil
import tempfile
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException, status
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from extractor import InvoicePipeline
from odoo_staging_uploader import (
    OdooClient,
    create_staging_record,
    create_vendor_bill_from_staging,
    DEFAULT_STAGING_MODEL,
    DEFAULT_LINE_MODEL
)

app = FastAPI(title="GST OCR Compliance Server")

# Mount frontend files
static_dir = Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# Helper to initialize Odoo client
def get_odoo_client():
    base_url = os.environ.get("ODOO_URL")
    db = os.environ.get("ODOO_DB")
    login = os.environ.get("ODOO_LOGIN")
    api_key = os.environ.get("ODOO_API_KEY")
    if not all([base_url, db, login, api_key]):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Odoo credentials not configured in backend .env file."
        )
    return OdooClient(base_url, db, login, api_key)

# API: Config endpoint to show status to UI
@app.get("/api/config")
def get_config():
    return {
        "odoo_url": os.environ.get("ODOO_URL", ""),
        "staging_model": os.environ.get("ODOO_STAGING_MODEL", DEFAULT_STAGING_MODEL),
    }

# API: Extract data from file upload
@app.post("/api/extract")
async def extract_invoice(file: UploadFile = File(...)):
    # Save file to a temp location
    suffix = Path(file.filename).suffix
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        shutil.copyfileobj(file.file, temp_file)
        temp_path = temp_file.name

    try:
        pipeline = InvoicePipeline()
        # Process invoice using local PaddleOCR + Mistral AI
        result = pipeline.process_document(temp_path, debug=True)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Unable to extract structured data from this invoice."
            )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Extraction failed: {str(e)}"
        )
    finally:
        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)

# Models for Staging
class LineItem(BaseModel):
    description: str
    quantity: float
    unit_price: float
    total: float

class StagingPayload(BaseModel):
    vendor_name: str
    vendor_address: Optional[str] = None
    invoice_number: str
    invoice_date: str
    currency: Optional[str] = "INR"
    vendor_gstin: Optional[str] = None
    customer_gstin: Optional[str] = None
    tax_id: Optional[str] = None
    subtotal_amount: float
    cgst_amount: Optional[float] = 0.0
    sgst_amount: Optional[float] = 0.0
    igst_amount: Optional[float] = 0.0
    tax_amount: float
    tip_amount: Optional[float] = 0.0
    total_amount: float
    authorized_amount: Optional[float] = 0.0
    line_items: List[LineItem]
    needs_review: bool
    ocr_confidence: float

# API: Stage to Odoo
@app.post("/api/stage")
def stage_invoice(payload: StagingPayload):
    try:
        client = get_odoo_client()
        staging_model = os.getenv("ODOO_STAGING_MODEL", DEFAULT_STAGING_MODEL)
        line_model = os.getenv("ODOO_STAGING_LINE_MODEL", DEFAULT_LINE_MODEL)
        
        # Convert Pydantic payload to dict
        payload_dict = payload.model_dump()
        
        # Call uploader function (pass None for PDF path since it's already extracted)
        staging_id = create_staging_record(
            client=client,
            payload=payload_dict,
            pdf_path=None,
            staging_model=staging_model,
            line_model=line_model,
            review_threshold=0.75
        )
        return {"status": "staged", "staging_id": staging_id}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Odoo Staging failed: {str(e)}"
        )

# Models for Posting
class PostPayload(BaseModel):
    staging_id: int

# API: Post to Odoo Account Move
@app.post("/api/post")
def post_invoice(payload: PostPayload):
    try:
        client = get_odoo_client()
        staging_model = os.getenv("ODOO_STAGING_MODEL", DEFAULT_STAGING_MODEL)
        line_model = os.getenv("ODOO_STAGING_LINE_MODEL", DEFAULT_LINE_MODEL)
        expense_account_id = int(os.getenv("ODOO_DEFAULT_EXPENSE_ACCOUNT_ID", "0"))
        
        if not expense_account_id:
             raise HTTPException(
                 status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                 detail="Expense account ID is not configured (ODOO_DEFAULT_EXPENSE_ACCOUNT_ID)."
             )

        bill_id = create_vendor_bill_from_staging(
            client=client,
            staging_id=payload.staging_id,
            expense_account_id=expense_account_id,
            staging_model=staging_model,
            line_model=line_model
        )
        return {"status": "posted", "vendor_bill_id": bill_id}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Odoo Posting failed: {str(e)}"
        )

# API: Verify GSTIN return filing status (simulated GSP API check)
@app.get("/api/gst-status")
def check_gst_status(gstin: str):
    # Simulated compliance logic
    if not gstin or len(gstin) != 15:
        raise HTTPException(status_code=400, detail="Invalid GSTIN format.")
    
    # Check digit code state prefix
    try:
        state_code = int(gstin[:2])
    except ValueError:
        return {"status": "Suspended", "compliant": False, "details": "Invalid state code format"}

    # Mock success / compliance for standard state codes
    if state_code > 0 and state_code <= 38:
        return {
            "gstin": gstin,
            "status": "Active",
            "legal_name": f"Vendor GST Registered Entity Ltd",
            "compliant": True,
            "details": "GSTR-3B filed up-to-date. Tax paid successfully."
        }
    else:
        return {
            "gstin": gstin,
            "status": "Inactive",
            "compliant": False,
            "details": "Filing delinquent (GSTR-3B missing for last 3 periods)"
        }

# Redirect root to static index.html
@app.get("/", response_class=HTMLResponse)
def read_root():
    index_file = static_dir / "index.html"
    if index_file.exists():
        return HTMLResponse(content=index_file.read_text(encoding="utf-8"))
    return HTMLResponse(content="<h1>GST Dashboard API Server running.</h1><p>Visit /static/index.html</p>")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
