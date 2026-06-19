# AP Automation Platform Architecture

This document describes the system components, data pipelines, validation rules engine, and ERP integrations of the Accounts Payable (AP) Automation MERN stack web application.

---

## 1. High-Level Architecture

The platform follows a split-tier architecture consisting of a **React Single Page Application (SPA) Frontend**, a **Node.js/Express API Backend**, a **Python OCR/AI Extraction Pipeline**, and an integration bridge to **Odoo ERP**.

```mermaid
graph TD
    %% Frontend Subsystem
    subgraph Frontend [React SPA Client - Port 5000]
        UI[Dashboard & Review Page]
        API_Client[API Client / utils/api.js]
    end

    %% Backend Subsystem
    subgraph Backend [Node.js & Express API - Port 5000]
        Server[server.js Entrypoint]
        Routes[API Routes /routes/]
        Rules[Rules Engine /utils/rulesEngine.js]
        OdooBridge[Odoo Bridge /utils/odooBridge.js]
    end

    %% Python Services
    subgraph Python_Services [Subprocess Pipeline]
        OCR[extractor.py - PaddleOCR & Mistral]
        OdooSync[odoo_sync.py - Attachment Fetch]
        OdooPost[odoo_staging_uploader.py - Bill Creator]
    end

    %% External Services
    Cloudinary[(Cloudinary Secure Storage)]
    MongoDB[(MongoDB Atlas / Mock DB)]
    OdooERP[Odoo ERP XML-RPC Services]

    %% Communications
    UI -->|User Action| API_Client
    API_Client -->|JSON / Multi-part| Server
    Server --> Routes
    Routes -->|Evaluate Rules| Rules
    Routes -->|Trigger Bridge| OdooBridge
    
    %% Python Integrations
    Routes -->|Spawn Subprocess| OCR
    Routes -->|Spawn Subprocess| OdooSync
    OdooBridge -->|Spawn Subprocess| OdooPost

    %% External Database / Storage integrations
    Routes -->|CRUD Docs| MongoDB
    Routes -->|Upload PDF/Image| Cloudinary
    OCR -->|Return JSON| Routes
    OdooSync -->|Read Attachments| OdooERP
    OdooPost -->|Write Move/Bill| OdooERP
```

---

## 2. Detailed Data Flow Pipelines

### 2.1 Invoice Upload & OCR Extraction Pipeline
When a user uploads a new invoice, the system processes it through a secure multi-stage workflow:

```mermaid
sequenceDiagram
    autonumber
    actor Clerk as AP Clerk
    participant UI as React Uploader
    participant API as Node.js Server
    participant Cloud as Cloudinary
    participant Python as extractor.py (Python)
    participant DB as MongoDB Atlas

    Clerk->>UI: Select PDF/Image & Upload
    UI->>API: POST /api/upload (Multipart FormData)
    
    rect rgb(240, 248, 255)
        note right of API: Upload to Cloud Storage
        API->>Cloud: Upload Temporary File
        Cloud-->>API: Return Secure Document URL
    end

    rect rgb(245, 245, 245)
        note right of API: OCR Extraction Subprocess
        API->>Python: Exec extractor.py <temp_file_path>
        Python->>Python: Execute PaddleOCR (Text Localization)
        Python->>Python: Execute Mistral AI (Structured JSON Mapping)
        Python-->>API: Return Extraction JSON File
    end

    rect rgb(255, 240, 245)
        note right of API: Rules Validation Engine
        API->>API: Evaluate Business Rules (GST, PO, Tolerances)
        alt Rules Passed
            API->>DB: Save Invoice (Status: Needs Review)
        else Validation Rules Failed
            API->>DB: Save Invoice (Status: Exception)
        end
    end

    API-->>UI: Return New Invoice Payload
    UI-->>Clerk: Render Review Staging Queue
```

---

## 3. Detailed Component Breakdown

### 3.1 React SPA Frontend (`/frontend`)
*   **Routing Layout (`App.jsx`)**: Implements sidebar dashboard navigation, a Developer Role Swapper (switchboard simulating role permissions), and globally accessible system notifications.
*   **Staging Queue (`StagingQueue.jsx`)**: The operations deck. Shows a paginated directory of invoices, allows keyword searches, filter statuses, and batch approvals/posting.
*   **Invoice Review (`InvoiceReview.jsx`)**: Side-by-side zoomable layout. Shows the Cloudinary-hosted document (PDF/Image) on the left pane and metadata edits, items breakdown table, and rules error logs on the right.
*   **Exception Queue (`ExceptionQueue.jsx`)**: Tracks invoices currently locked due to variance issues. Allows Finance Managers or Admins to bypass rule failures using the **Override** action.
*   **API Interface Client (`utils/api.js`)**: Automatically includes auth credentials and intercepts communication failures. If the Node.js API server drops offline, it falls back to a mock local state manager (`mockFallback`) to enable disconnected frontend simulation.

### 3.2 Node.js & Express API Backend (`/backend`)
*   **Database Seeder (`config/dbSeeder.js`)**: Automatically seeds initial rules, mock POs, and audit logs into MongoDB Atlas if the collections are empty.
*   **Rules Engine (`utils/rulesEngine.js`)**: Validates documents against 4 business rules:
    *   *Duplicate Detection*: Flags similar vendor invoices (matching invoice numbers or matching total + date combinations).
    *   *GST Validation*: Validates state and pan check digit layout using standard 15-character regex checks.
    *   *PO Matching & Price Tolerances*: Computes 2-way and 3-way matches (validates items descriptions, quantities, and price differences against a 5% tolerance limit).
    *   *Amount Threshold Routing*: Routes payments exceeding ₹5,000/$5,000 for multi-manager review.
*   **Audit Logger (`/routes/audits.js`)**: Appends records into the `AuditTrail` collection for every system event (uploads, Odoo syncs, exceptions overrides, database edits) to track user/role accountability.

### 3.3 Python Integration Bridge (`/backend/utils`)
*   **Odoo Synchronizer (`odoo_sync.py`)**: Connects to the ERP via XML-RPC. Fetches raw attachments, syncs invoice lines, decodes base64 document files, and feeds them into the MERN backend.
*   **ERP Posting Bridge (`odoo_staging_uploader.py`)**: When an invoice is approved and posted, the Node.js server executes this python script. It parses validation tokens and generates a formal `account.move` vendor bill in Odoo, completing the pipeline.
